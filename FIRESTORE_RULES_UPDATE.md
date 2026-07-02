# Firestore rules update — post edit/resubmit feature

This project shares its Firestore project (`tuition-core-f00c7`) with another app, so the
rules below are **not deployed automatically**. Merge these two changes into the `match
/posts/{postId}` block of your live rules (they only touch the `posts` collection — nothing
else needs to change).

## What changed and why

The new "Edit post" feature (edit a pending post, or edit-and-resubmit a rejected one) needs:

1. **Authors to be able to read their own posts regardless of status.** The rules previously
   only let an author read `approved` posts (or a superAdmin read everything) — there was no
   rule letting an author read their own `pending`/`rejected` post, which the edit page needs
   to fetch and prefill.
2. **Authors to be able to update their own `rejected` posts, not just `pending` ones.** The
   rules previously only allowed self-updates while `status == 'pending'`. Editing a rejected
   post and resubmitting it for review needs this widened to include `rejected`.

Nothing else in the app relies on rejected/pending posts being unreadable by their author, so
this should be safe to merge as-is. If your other (Flutter) app also creates/reads documents
in the `posts` collection under the same rules, double check it doesn't depend on authors
being unable to read their own non-approved posts (unlikely, but worth a glance).

## Diff to apply

Inside `match /posts/{postId} { ... }`, add one `allow read` and widen the existing
`allow update`:

```diff
       // Authenticated users can read all approved posts
       allow read: if isAuthenticated() && resource.data.status == 'approved';

+      // Author can read all of their own posts regardless of status
+      // (needed for "My Posts" and editing pending/rejected posts)
+      allow read: if isAuthenticated() && resource.data.authorId == request.auth.uid;
+
       // SuperAdmin can read/manage all posts
       allow read, update, delete: if isAuthenticated() && isSuperAdmin(request.auth.uid);

       // Authenticated users can create posts
       allow create: if isAuthenticated();

-      // Author can update their own pending posts
-      allow update: if isAuthenticated() &&
-                       resource.data.authorId == request.auth.uid &&
-                       resource.data.status == 'pending';
+      // Author can update their own pending or rejected posts (re-editing a
+      // rejected post resubmits it for review)
+      allow update: if isAuthenticated() &&
+                       resource.data.authorId == request.auth.uid &&
+                       (resource.data.status == 'pending' || resource.data.status == 'rejected');
```

## Full updated block (for reference)

```
match /posts/{postId} {
  // Anyone can read approved public posts
  allow read: if resource.data.status == 'approved' &&
                 resource.data.visibility == 'public';

  // Authenticated users can read all approved posts
  allow read: if isAuthenticated() && resource.data.status == 'approved';

  // Author can read all of their own posts regardless of status
  // (needed for "My Posts" and editing pending/rejected posts)
  allow read: if isAuthenticated() && resource.data.authorId == request.auth.uid;

  // SuperAdmin can read/manage all posts
  allow read, update, delete: if isAuthenticated() && isSuperAdmin(request.auth.uid);

  // Authenticated users can create posts
  allow create: if isAuthenticated();

  // Author can update their own pending or rejected posts (re-editing a
  // rejected post resubmits it for review)
  allow update: if isAuthenticated() &&
                   resource.data.authorId == request.auth.uid &&
                   (resource.data.status == 'pending' || resource.data.status == 'rejected');

  // ...likes/comments/viewers/shares subcollections unchanged...
}
```

## Until you deploy this

The app code is already live with the edit feature. Without this rule change deployed:

- Editing a **pending** post will still work as before (the old rule already allowed that).
- Editing a **rejected** post will fail with a Firestore permission error when saving — the
  app will show "Failed to update post: ..." with the underlying permission-denied reason in
  the browser console.
- The "My Posts" tab / edit page reading a post you haven't fully loaded via `getMyPosts()`
  should still work day-to-day since that list already relies on whatever read permission is
  currently live for authors on their own posts.
