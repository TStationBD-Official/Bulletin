# Feeds Page — Modifications Beyond the Original Blueprint

This document captures everything that was actually built in the Bulletin project (a Next.js
website — **not** Flutter) on top of `feeds_website_blueprint.md`, so you can port the same
features/behavior into the **Flutter tutoring app** that shares this Firebase project
(`tuition-core-f00c7`).

**How to read this**: the Firestore schema, security rules, and indexes in §2–§4 are
backend-agnostic — copy them as-is, they work identically from Dart/`cloud_firestore` as they do
from the web client. Everything past that describes *feature behavior and business logic* in
framework-neutral terms, with Flutter package suggestions where relevant — the original
implementation is React/Next.js code that has no direct Dart equivalent, so don't look for
literal code to port there, just the underlying logic.

---

## 1. Firestore schema — additions & corrections to the blueprint

### 1.1 `posts` — additional fields not in the blueprint

```
posts/{postId}
  ...all blueprint fields, plus:
  title: string?                  // optional headline, separate from content preview
  categoryId: string?             // see new `categories` collection, §1.2
  categoryName: string?           // denormalized for display without a join
  categoryColor: string?          // denormalized hex color, e.g. "#f59e0b"
  categoryIcon: string?           // denormalized emoji
  fileAttachments: FileAttachment[]?   // non-image files — see below
  adminGroupId: string?           // internal-post visibility scope, NOT the same as adminId — §1.5
  isHidden: bool?
  hiddenAt: Timestamp?
  hiddenBy: string?
  hideReason: string?
  deletedAt: Timestamp?
  deletedBy: string?
  updatedAt: Timestamp?
  updatedBy: string?
  editHistory: EditHistoryEntry[]?

FileAttachment:
  url: string        // drive.google.com/file/d/{id}/view — NOT the lh3 image CDN link, see §5
  name: string        // original filename (user can rename before publishing)
  mimeType: string
  size: number?        // bytes, display only

EditHistoryEntry:
  editedAt: Timestamp
  editedBy: string
  previousContent: string
```

`richContent` is Quill Delta JSON (`{"ops": [...]}`), same as the blueprint says. **This is
actually convenient for Flutter**: the `flutter_quill` package understands Quill Delta natively
(`Delta.fromJson(jsonDecode(richContent)['ops'])`), so posts created on the website can be
rendered/edited in the Flutter app without any format conversion, and vice versa — as long as
the Flutter editor sticks to formats both sides understand (see §5.3 for the two *custom*
attributes the website added that a Flutter editor won't recognize by default).

### 1.2 New collection: `categories`

**Entirely missing from the blueprint.** Powers category filter tabs and category badges on
posts. If the Flutter app wants matching category filtering, read this collection directly.

```
categories/{slug}          // doc ID = slug, e.g. "mathematics"
  id: string               // same as doc ID
  name: string
  slug: string
  description: string
  color: string             // hex, e.g. "#f59e0b"
  icon: string               // single emoji
  postCount: number          // NOT auto-maintained by a trigger — incremented manually wherever a post is created
  isDefault: bool             // true only for "general"; can't be deleted
  isActive: bool               // soft "hide from picker" flag
  order: number                // display sort order, ascending
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string             // uid
  updatedBy: string?
```

10 categories are pre-seeded (idempotent seed check on first admin visit): General (default),
Mathematics, Science, English, History & Geography, Technology, Arts & Creativity, Study Tips,
Announcements, Q&A — each with its own color/icon. Ask if you want the exact seed values copied
over; they're just data, easy to replicate.

Deleting a category is a soft-delete: `isActive: false` + reassign all its posts' `categoryId`
back to `"general"`.

### 1.3 Saved posts — location differs by role (blueprint only covers `feeds_user_only`)

The blueprint says `savedPosts` lives on `feeds_user_only/{uid}.savedPosts`. That's only true for
website-only users. For every other role (`admin`/`student`/`guardian`/`superAdmin`), those
collections are **read-only** in Firestore rules (owned by the Flutter app's own write rules —
the website can't add a self-write rule there), so saved posts for those roles had to go
somewhere else:

```
users_metadata/{uid}
  ...existing fields
  savedPosts: string[]?   // written with merge:true, never touches role/selectedRole
```

**This directly affects you**: if the Flutter app wants a "save post" feature, or wants to read
what the website already saved for a user, check `users_metadata/{uid}.savedPosts` for
non-feeds_user roles, and `feeds_user_only/{uid}.savedPosts` only for that one role. Don't assume
one location.

### 1.4 Author role resolution — same 5-collection lookup, just cached

The blueprint's role resolution order (super_admins → admins → students → guardians →
feeds_user_only → create new) is unchanged. Implementation note if useful: the website caches
resolved author profiles in memory per session to avoid re-querying the same author repeatedly
across a feed render — worth doing something similar in Flutter (e.g. an in-memory `Map` cache)
if the feed does per-post author lookups.

### 1.5 Internal post visibility — `adminGroupId`, not `adminId`

The blueprint's internal-post model is underspecified. Actual implementation:

- `adminId` = who **approved** the post (only set when auto-approved at creation time).
- `adminGroupId` = whose **circle** an internal post belongs to — this is what actually scopes
  visibility, and it's the field to filter on. For an admin's own post, `adminGroupId = adminUid`.
  For a student/guardian's post, `adminGroupId = their assigned admin's uid` (read from their own
  profile doc's `adminId` field).
- A feed needs two separate queries merged: one for public approved posts (open to everyone), one
  for internal posts where `adminGroupId == currentUser'sGroupId` (or *all* internal posts if the
  viewer is superAdmin).
- `feeds_user` role should never see internal posts at all — don't attach that second query for
  that role.

If the Flutter app's feed doesn't currently filter internal posts this way, this is the field to
add/use.

---

## 2. Firestore Security Rules — current, deployed-tested version

The blueprint's rules section is a reasonable draft but has since diverged in real, tested ways.
**Use this version, not the blueprint's**, when updating the shared project's rules (talk to
whoever owns rules deployment for `tuition-core-f00c7` — this affects both apps since it's one
Firestore database):

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSuperAdmin(uid) {
      return exists(/databases/$(database)/documents/super_admins/$(uid));
    }
    function isAuthenticated() {
      return request.auth != null;
    }

    // ===== POSTS =====
    match /posts/{postId} {
      allow read: if resource.data.status == 'approved' &&
                     resource.data.visibility == 'public';
      allow read: if isAuthenticated() && resource.data.status == 'approved';

      // Author can read ALL of their own posts regardless of status — required
      // for "My Posts" and for loading a pending/rejected post to edit it.
      allow read: if isAuthenticated() && resource.data.authorId == request.auth.uid;

      allow read, update, delete: if isAuthenticated() && isSuperAdmin(request.auth.uid);
      allow create: if isAuthenticated();

      // Author can edit their own PENDING or REJECTED posts — re-editing a
      // rejected post is how "fix and resubmit" works (§5.4). Approved posts
      // are NOT author-editable by design.
      allow update: if isAuthenticated() &&
                       resource.data.authorId == request.auth.uid &&
                       (resource.data.status == 'pending' || resource.data.status == 'rejected');

      match /likes/{userId} {
        allow read: if isAuthenticated();
        allow write, delete: if isAuthenticated() && request.auth.uid == userId;
      }
      match /comments/{commentId} {
        allow read: if true;
        allow create: if isAuthenticated();
        allow update, delete: if isAuthenticated() &&
          (request.auth.uid == resource.data.userId || isSuperAdmin(request.auth.uid));
        match /replies/{replyId} {
          allow read: if true;
          allow create: if isAuthenticated();
          allow update, delete: if isAuthenticated() &&
            (request.auth.uid == resource.data.userId || isSuperAdmin(request.auth.uid));
          match /likes/{userId} {
            allow read: if isAuthenticated();
            allow write: if isAuthenticated() && request.auth.uid == userId;
          }
        }
      }
      match /viewers/{userId} {
        allow read: if isAuthenticated() && isSuperAdmin(request.auth.uid);
        allow write: if isAuthenticated() && request.auth.uid == userId;
      }
      match /shares/{shareId} {
        allow read: if isAuthenticated() && isSuperAdmin(request.auth.uid);
        allow write: if isAuthenticated();
      }
    }

    // ===== CATEGORIES ===== (MISSING FROM BLUEPRINT — must be added)
    match /categories/{categoryId} {
      allow read: if true;   // public — feed tabs need this even logged out
      allow write: if isAuthenticated() && isSuperAdmin(request.auth.uid);
    }

    // ===== FEEDS_USER_ONLY =====
    match /feeds_user_only/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && request.auth.uid == userId &&
                       request.resource.data.role == 'feeds_user';
      allow read, update: if isAuthenticated() && isSuperAdmin(request.auth.uid);
      allow delete: if isAuthenticated() && isSuperAdmin(request.auth.uid);
    }

    // ===== NOTIFICATIONS =====
    match /notifications/{notifId} {
      allow read: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow update: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow write: if isAuthenticated() && isSuperAdmin(request.auth.uid);
      allow create: if isAuthenticated();
    }

    // ===== REPORTS =====
    match /reports/{reportId} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated() &&
        (request.auth.uid == resource.data.reportedBy || isSuperAdmin(request.auth.uid));
      allow update, delete: if isAuthenticated() && isSuperAdmin(request.auth.uid);
    }

    // ===== ADMIN_LOGS =====
    match /admin_logs/{logId} {
      allow read, write: if isAuthenticated() && isSuperAdmin(request.auth.uid);
    }

    // ===== APP_SETTINGS =====
    match /app_settings/{document=**} {
      allow read: if true;
      allow write: if isAuthenticated() && isSuperAdmin(request.auth.uid);
    }

    // ===== USERS_METADATA ===== (also holds savedPosts for non-feeds_user roles, §1.3)
    match /users_metadata/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow read, write: if isAuthenticated() && isSuperAdmin(request.auth.uid);
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && request.auth.uid == userId &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'selectedRole']);
    }

    // ===== Role collections — these are the Flutter app's own collections =====
    match /super_admins/{userId} { allow read: if isAuthenticated(); }
    match /admins/{userId}       { allow read: if isAuthenticated(); }
    match /students/{userId}     { allow read: if isAuthenticated(); }
    match /guardians/{userId}    { allow read: if isAuthenticated(); }

    match /{document=**} { allow read, write: if false; }
  }
}
```

**Important**: `super_admins`/`admins`/`students`/`guardians` are read-only *from the website's
side* — the website deliberately never writes to them (all self-writes for those roles should
continue to go through whatever the Flutter app already does). Don't let a "port this feature"
task accidentally add website write-access to these; route around it the way `users_metadata`
was used for savedPosts (§1.3) instead.

---

## 3. Firestore Indexes — actual set in use

```json
{
  "indexes": [
    { "collectionGroup": "posts", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "posts", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "visibility", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "posts", "fields": [
      { "fieldPath": "authorId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "notifications", "fields": [
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "notifications", "fields": [
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "isUrgent", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "feeds_user_only", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "reports", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "admin_logs", "fields": [
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "admin_logs", "fields": [
      { "fieldPath": "adminId", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]}
  ]
}
```

### Pattern worth carrying into Flutter: avoid composite indexes for low-volume queries

Several real bugs on the website were `FAILED_PRECONDITION: query requires an index` errors,
each one silently swallowed and surfacing only as "feature X mysteriously does nothing." Fix
pattern used everywhere: for one-off/low-volume queries (rate limiting, "my posts", "related
posts", "top authors", "trending"), query on a **single field only**, bound with `.limit(N)`,
then filter/sort the rest client-side. `cloud_firestore` in Dart has the exact same composite
index requirements as the JS SDK, so this applies directly — if you add a Flutter query with two
`.where()` clauses plus an `.orderBy()`, check whether it needs a new index *before* shipping,
or restructure to filter client-side if it's a low-volume query.

---

## 4. Feature behavior specs (port the logic, not the code)

These are new features/behaviors built on the website that aren't in the blueprint. Described in
framework-neutral terms — implement with whatever Flutter/Dart packages fit.

### 4.1 Category management
CRUD for categories (§1.2): create/edit/deactivate/soft-delete, each with a name, description,
emoji icon, hex color, and manual sort order. SuperAdmin-only. Deleting reassigns affected posts
to the "general" category rather than leaving them orphaned or blocking the delete.

### 4.2 File attachments (PDF/Word/Excel/PowerPoint/text)
Separate from inline images — a post can have both. Uploaded to the same Google Drive account
used for images, but needs the **Drive viewer URL**, not the image-CDN URL (§5) — using the wrong
one means PDFs/docs may not open correctly. Users can rename the attachment (display name only,
not the underlying Drive filename) before publishing. Shown as a tappable
icon+name+type+size row that opens the file (Drive's native preview) in the OS browser/viewer.

### 4.3 Post editing (author self-service, not just superAdmin)
Not in the blueprint at all — it only gives superAdmin an edit capability. This adds
**author-initiated editing**, restricted to `pending` or `rejected` posts (see rules §2):
- Author sees an edit option on their own post only while it's pending or rejected.
- Editing a pending post re-runs the same approval decision as creating a new post (stays
  pending, or auto-approves per site settings) — it doesn't just silently update in place.
- Editing a **rejected** post clears the rejection reason and resubmits it for review — this is
  the "fix and resubmit" flow, and it's the reason the rules had to allow updates while
  `status == 'rejected'`, not just `'pending'`.
- No separate edit screen needed — the same compose/create form can be reused, just pre-filled
  from the existing post and branching to an "update" write instead of a "create" write on
  submit.

### 4.4 Related posts
Given a post, find up to 2 other posts in the **same category**, approved + public, ranked by
engagement (likes + comments + shares + views), excluding the post itself. Shown near the bottom
of the post detail view: title, a short excerpt, and the author's avatar/name.

### 4.5 PDF export (superAdmin-only)
A superAdmin can export any post as a PDF. On the web this uses the browser's native print
engine (zero extra libraries, perfect font/image fidelity for free). **Flutter doesn't have that
shortcut** — you'd want the [`printing`](https://pub.dev/packages/printing) or
[`pdf`](https://pub.dev/packages/pdf) package to actually generate a PDF document, or
`WebView`-based print if targeting a platform that supports it. Behavior to replicate:
- A letterhead/header block: TuitionCore logo, tagline, a clickable link, and a **QR code**
  pointing to the TuitionCore website (Flutter: [`qr_flutter`](https://pub.dev/packages/qr_flutter)
  generates this client-side, no network call).
- Post title, author, date, full body content, and any file attachments.
- Every link/attachment URL should be printed as **visible text**, not just an embedded
  hyperlink — PDF viewers and generation methods vary in whether they preserve clickable links,
  so don't rely on that alone; always show the raw URL too.
- Gate the whole feature to superAdmin role.

### 4.6 Related UX additions (lower priority, describe if asked)
- **Mobile carousels** for Trending Posts / Top Authors: the website's original sidebar-only
  layout for these was invisible on narrow screens; added auto-sliding single-card carousels
  (one item visible at a time, ~4.5s auto-advance, tap-able position dots) as the small-screen
  equivalent. Relevant if the Flutter app has an analogous "Trending"/"Top Authors" widget that's
  cramped on phone-sized screens — the `PageView` + `Timer.periodic` pattern in Flutter is a
  natural fit for the same behavior.
- **Light/dark/auto theme + selectable accent color**: not in the blueprint. If the Flutter app
  wants to match the website's theming, the concept is: a persisted theme mode (light/dark/
  follow-system) plus a separate persisted "accent color" choice from a small fixed palette
  (5 options on the website: blue/violet/emerald/orange/rose) that recolors primary UI elements.
  Flutter's `ThemeData`/`ColorScheme` maps onto this reasonably directly.

---

## 5. Google Drive integration — corrections to the blueprint

The blueprint's upload flow is close but has one important gap, relevant regardless of client:

**Two different URL shapes are needed depending on content type**, both derived from the same
uploaded Drive file ID:
```
Images (inline in posts):      https://lh3.googleusercontent.com/d/{fileId}
Non-image files (PDF/etc.):    https://drive.google.com/file/d/{fileId}/view
```
The image-CDN URL is **not reliable for non-image files** — using it for a PDF can silently fail
to serve/render correctly. Both need the uploaded file's sharing permission set to
`role: reader, type: anyone` for either URL to work without the viewer being signed into the
uploading account.

**Token refresh — flagging this loudly since it was a real, previously-undiscovered bug on the
website that silently broke uploads after ~60 minutes**: Google Drive access tokens expire after
60 minutes no matter what. The website's failure mode (fixed, but worth avoiding in Flutter too):
its silent-refresh mechanism looked correct in code review but never actually worked, because
**the browser script that provides the token-refresh API was never loaded** — an easy category
of bug to reproduce differently in Flutter (e.g. forgetting to request an offline/refreshable
scope, or not handling `GoogleSignIn`'s silent-reauth path) where everything *appears* to work in
initial testing (first hour of any session) and then mysteriously fails for every user after
that. Whatever Google Sign-In package the Flutter app already uses for Drive access — verify
end-to-end that a token obtained at sign-in is actually being refreshed in the background past
the 60-minute mark, not just assumed to work because the code compiles. This is exactly the kind
of bug that hides successfully through casual testing.

---

## 6. Bugs found & fixed on the website (data-model-level ones apply to Flutter too)

Most of these were web-implementation-specific (rich-text rendering library quirks) and won't
recur in Flutter with different tooling — listed briefly for awareness. The ones that matter
regardless of client are marked **[data-model]**.

1. Rich-text-to-HTML conversion library had a method-name mismatch (`.render()` vs `.convert()`)
   that silently degraded every post render to plain text — web-specific, not a Flutter concern
   unless using a similar Dart HTML-conversion package with the same trap.
2. **[data-model]** Firestore's 1MB document limit + inline `data:` image URIs: if an image
   upload fails, don't leave a base64-encoded fallback embedded in the saved rich content — it
   can blow past the per-field size limit and fail the whole document write with a cryptic
   error. Validate/strip before saving, on any client.
3. Image resize/alignment persistence had an async race between direct DOM mutation and the
   editor's internal state sync — web/Quill.js-specific, not applicable to `flutter_quill`'s
   different internal model, but the general lesson (verify a UI change actually landed in the
   data you're about to save, don't just trust the visual state) is universal.
4. **[data-model]** Don't render inline content images AND a separate "gallery" of the same
   image URLs when a post has rich content — the images are already embedded inline. Only show
   a separate gallery for legacy/plain-text posts that have image URLs but no rich content at
   all. Relevant if the Flutter feed/detail view renders both `richContent` and `imageUrls`
   independently.
5. Dark-mode text readability broken by inline colors from pasted web content — web-clipboard
   specific, not a Flutter concern (no paste-from-Wikipedia path there).
6. **[data-model]** One failed author lookup shouldn't blank out an entire list. Any batch
   author-resolution (`Future.wait` in Dart terms) needs each individual lookup to catch its own
   errors — otherwise one bad/missing author document fails the whole batch and an entire
   feed/widget silently renders empty with no visible error.
