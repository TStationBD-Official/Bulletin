# Feeds Website Blueprint

A comprehensive guide to building a **separate blogging/social feeds website** using the same Firebase project as the Tuition Core Flutter app.

---

## 🔑 Firebase Credentials (Web App)

Use these credentials for the website's Firebase config:

```javascript
// firebase.config.js (or .env variables)
const firebaseConfig = {
  apiKey: "AIzaSyAFsRAX-KPuzmhR4-6pJoxBsjNJYILQuGU",
  authDomain: "tuition-core-f00c7.firebaseapp.com",
  projectId: "tuition-core-f00c7",
  storageBucket: "tuition-core-f00c7.appspot.com",
  messagingSenderId: "80817603385",
  appId: "1:80817603385:web:86f6874e0d9b43d2c77f0a"
};
```

**All features use the same Firestore database and Google Drive account as the Flutter app.**

---

## 💻 Recommended Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org) (App Router) + TypeScript
- **Auth**: Firebase Auth + [Google Sign-In](https://developers.google.com/identity/protocols/oauth2)
- **Database**: Firestore (same project)
- **Storage**: Google Drive API (same scope as app) or Firebase Storage
- **Rich Text**: [Quill.js](https://quilljs.com) (via [react-quill](https://github.com/zenoamaro/react-quill)) to render/edit Quill Delta JSON
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) or [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) + [Framer Motion](https://www.framer.com/motion/) for animations
- **UI Components**: Shadcn/ui or Headless UI
- **Hosting**: Firebase Hosting or Vercel

---

## 📋 Firestore Collections & Schema

### Existing Collections (Shared with App)

#### `posts` (main collection)
```
{
  id: string,
  authorId: string,           // Firebase UID
  authorName: string,
  content: string,            // plain text body
  richContent: string | null, // Quill Delta JSON
  imageUrls: string[],
  createdAt: Timestamp,
  status: "pending" | "approved" | "rejected",
  likes: number,              // denormalized counter
  comments: number,           // denormalized counter
  shares: number,
  views: number,
  visibility: "public" | "internal",
  adminId: string | null,     // for internal posts
  rejectionReason: string | null
}
```

#### `posts/{postId}/likes` (subcollection)
One document per user who liked:
```
{
  userId: string,  // doc ID
  likedAt: Timestamp
}
```

#### `posts/{postId}/comments` (subcollection)
```
{
  id: string,
  userId: string,
  userName: string,
  content: string,
  likes: number,
  replies: number,
  createdAt: Timestamp
}
```

#### `posts/{postId}/comments/{commentId}/replies` (sub-subcollection)
Same schema as comments (threaded, 3 levels max).

#### `posts/{postId}/viewers` (subcollection)
One document per unique viewer:
```
{
  userId: string,  // doc ID
  viewedAt: Timestamp
}
```

#### `posts/{postId}/shares` (subcollection)
One document per share event:
```
{
  {userId}_{timestamp}: string,
  sharedAt: Timestamp
}
```

#### `users_metadata` (collection)
Lightweight metadata for all users (app + website):
```
{
  uid: string,  // doc ID
  role: "superAdmin" | "admin" | "student" | "guardian" | "feeds_user",
  selectedRole: string,
  email: string,
  lastLogin: Timestamp
}
```

#### `notifications` (collection)
```
{
  id: string,
  userId: string,
  type: "post" | "post_submitted" | "post_approved" | "post_rejected" | etc.,
  title: string,
  body: string,
  isUrgent: boolean,
  isRead: boolean,
  createdAt: Timestamp
}
```

#### `super_admins`, `admins`, `students`, `guardians` (user role collections)
Shared with Flutter app. Used for author photo resolution:
```
{
  id: string,  // Firebase UID
  email: string,
  name: string,
  profileImageUrl: string | null,
  driveEmail: string | null,
  ...role-specific fields
}
```

### New Collection: `feeds_user_only`

**Website-only users** (users not in any app role). When they sign in via Google and don't match any app role, create this doc:

```
{
  id: string,              // Firebase UID (doc ID)
  email: string,
  name: string,
  profileImageUrl: string | null,  // from Google profile
  driveEmail: string | null,       // from Google account
  createdAt: Timestamp,
  lastLogin: Timestamp,
  savedPosts: string[],            // array of post IDs bookmarked
  role: "feeds_user"               // constant
}
```

Also write to `users_metadata/{uid}`:
```
{
  role: "feeds_user",
  selectedRole: "feeds_user",
  email: string,
  lastLogin: Timestamp
}
```

### New Collection: `reports`

**User reports of inappropriate posts/comments/users**

```
{
  id: string,                    // doc ID
  postId: string | null,         // if reporting a post
  commentId: string | null,      // if reporting a comment
  userId: string | null,         // if reporting a user
  reportedBy: string,            // UID of reporter
  reason: string,                // "Spam", "Harassment", "Inappropriate", "Misleading", etc.
  description: string,           // additional details from reporter
  status: "open" | "reviewing" | "resolved" | "dismissed",
  createdAt: Timestamp,
  resolvedAt: Timestamp | null,
  resolution: string | null,     // action taken
  resolvedBy: string | null      // superAdmin UID who resolved
}
```

### New Collection: `admin_logs`

**Audit trail of all superAdmin moderation actions**

```
{
  id: string,                    // doc ID
  adminId: string,               // superAdmin UID who performed action
  action: string,                // "approve_post", "reject_post", "ban_user", "delete_post", etc.
  targetId: string,              // postId or userId
  targetType: "post" | "user" | "comment",
  details: object,               // action-specific metadata
  reason: string | null,         // explanation for action
  createdAt: Timestamp
}
```

### New Collection: `app_settings`

**Website-wide configuration (new doc: `feeds_website`)**

```
{
  moderationKeywords: string[],
  requireApprovalFor: "all" | "website_users_only" | "none",
  allowComments: boolean,
  allowSharing: boolean,
  allowNewSignups: boolean,
  requireEmailVerification: boolean,
  autoApproveAdminPosts: boolean,
  siteTitle: string,
  siteDescription: string,
  logoUrl: string,
  primaryColor: string,          // hex color
  secondaryColor: string,        // hex color
  termsOfService: string,        // HTML
  privacyPolicy: string,         // HTML
  communityGuidelines: string,   // HTML
  enableRateLimiting: boolean,
  maxPostsPerDay: number,
  maxCommentsPerDay: number,
  updatedAt: Timestamp,
  updatedBy: string              // superAdmin UID
}
```

---

## 🔐 Authentication Flow

### Google Sign-In

1. User clicks "Sign in with Google"
2. Firebase Auth handles OAuth pop-up/redirect
3. After successful auth, get user's Firebase UID
4. **Role Resolution** (in this order):
   - Query `super_admins/{uid}` → if found, user is **superAdmin** (can moderate)
   - Query `admins/{uid}` → if found, user is **admin**
   - Query `students/{uid}` → if found, user is **student**
   - Query `guardians/{uid}` → if found, user is **guardian**
   - Query `feeds_user_only/{uid}` → if found, user is **feeds_user** (existing website user)
   - None found → **Create** `feeds_user_only/{uid}` + `users_metadata/{uid}` (new website-only user)

5. Update `lastLogin` timestamp
6. Store auth state in app (Zustand or React Query)
7. Request Google Drive scope (`drive.file`) for image uploads

### Session Persistence

- Firebase Auth handles session persistence automatically
- Optionally store `users_metadata` in localStorage for faster role resolution on reload

---

## 🔄 Migration: Website User → App User

**This happens in the Flutter app automatically.**

When a `feeds_user_only` user signs into the **Flutter app** and selects a role (admin/student/guardian):

1. The app creates/updates the new role collection doc
2. Copies `savedPosts` array to the new role doc (if applicable)
3. **Deletes** `feeds_user_only/{uid}`
4. Updates `users_metadata/{uid}` with the new role

**For the website**: Simply check the 4-step role resolution above. If the user's UID is no longer in `feeds_user_only`, they've migrated to an app role. Show their updated profile data from the new role collection.

---

## 🎨 Features to Implement

### 1. Feed Page (`/`)

**Layout:**
- Header: Logo, Search bar, Sign in button (or user profile dropdown if signed in), "Write" button
- Main feed with 3 sections:
  1. **Latest Posts** — scrollable stream, limit 50, newest first
  2. **Trending Now** — top 3 posts by engagement (likes + comments + shares) in last 7 days
  3. **Top Authors** — top 8 authors by total engagement

**Interactions:**
- Click a post card → navigate to `/post/{postId}`
- Search filters posts client-side by `content` + `authorName`
- Infinite scroll or "Load more" button for pagination
- Stats cards at top showing total authors + total approved posts

**Firestore Queries:**
```
// Latest posts (approved, public only)
db.collection('posts')
  .where('status', '==', 'approved')
  .where('visibility', '==', 'public')
  .orderBy('createdAt', 'desc')
  .limit(50)

// Trending (past 7 days)
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
db.collection('posts')
  .where('status', '==', 'approved')
  .where('visibility', '==', 'public')
  .where('createdAt', '>=', sevenDaysAgo)
  .orderBy('createdAt', 'desc')
  // Then sort client-side by (likes + comments + shares) descending, take top 3
```

---

### 2. Post Card Component

**Displays on feed:**
- Author avatar (resolved from `super_admins` / `admins` / `students` / `guardians` by authorId)
- Author name + createdAt (relative time: "2 hours ago")
- Post content preview (first 200 chars or render Quill Delta to HTML, truncate if needed)
- Image thumbnails (first 3 images, carousel or grid)
- Engagement stats: ❤️ `{likes}`, 💬 `{comments}`, 👁️ `{views}`, 🔗 `{shares}`
- **Action buttons**:
  - Like/Unlike (heart icon, toggle state on Firestore `posts/{id}/likes/{uid}`)
  - Bookmark/Save (bookmark icon, write to `feeds_user_only/{uid}.savedPosts`)
  - Share (share icon, opens modal with Web Share API + copy link)
  - View Post (button or card click)

**Animations:**
- Post cards fade-in + slide-up on scroll (staggered, 0.05s delay between cards)
- Like button: scale bounce on click (spring, 1.0 → 1.2 → 1.0)
- Hover on card: subtle lift (shadow increase, y translation -4px)
- Image load: blur-in reveal (CSS transition)

---

### 3. Post Detail Page (`/post/[id]`)

**Displays:**
- Full post content (render Quill Delta to HTML with proper formatting: bold, italic, headings, lists, code blocks, etc.)
- All images in original size or lightbox gallery
- Author profile card (avatar, name, bio if applicable, link to `/author/{authorId}`)
- Engagement stats (likes, comments, shares, views)
- Share button
- Like/Unlike toggle
- **Comments section** (threaded):
  - Flat list of top-level comments (sorted by createdAt, newest first optional)
  - Each comment shows: avatar, name, createdAt, content, like count, reply count
  - Click "Reply" → expand reply input
  - Replies are nested (one level deep visually)
  - Support likes on comments and replies
  - Delete button (only for own comments)
  - Submit new comment form at top

**Firestore Queries:**
```
// Get post
db.collection('posts').doc(postId).get()

// Get comments
db.collection('posts').doc(postId).collection('comments')
  .orderBy('createdAt', 'desc')
  .get()

// Get replies for a comment
db.collection('posts').doc(postId).collection('comments')
  .doc(commentId).collection('replies')
  .orderBy('createdAt', 'asc')
  .get()

// Get likes for a post
db.collection('posts').doc(postId).collection('likes')
  .where('userId', '==', currentUserId)
  .limit(1)
  .get()  // returns empty if not liked, 1 doc if liked
```

**Actions:**
- First load: increment view count (write to `posts/{postId}/viewers/{uid}`)
- Like/unlike: transaction on `posts/{postId}/likes` + update `posts/{postId}.likes` counter
- Comment: write to `posts/{postId}/comments`
- Reply to comment: write to `posts/{postId}/comments/{commentId}/replies`
- Like comment/reply: similar to post like

**Animations:**
- Page load: fade-in
- Comment expand: smooth height transition
- Like button bounce same as feed

---

### 4. Create Post Page (`/compose`)

**Requires sign-in. Visibility rules:**
- Website `feeds_user_only` users: posts always `public`, status `pending` (awaiting superAdmin approval)
- `admin` users from app: can choose `public` or `internal`
- Other roles: cannot create (show access denied)

**Form:**
1. **Rich Text Editor** (Quill.js):
   - Full formatting toolbar: **bold**, *italic*, ~~strikethrough~~, underline
   - Heading levels (H1, H2, H3)
   - Bullet lists, ordered lists, blockquote
   - Code block, inline code
   - Text alignment (left, center, right)
   - Text color + highlight color
   - Font family (19 Google Fonts)
   - Font size (8–48pt slider)
   - Links
   - Undo/redo
   - Clear formatting

2. **Image Upload**:
   - Drag-and-drop or file picker
   - Upload to Google Drive (same as app) or Firebase Storage
   - Insert into editor as Quill BlockEmbed (`type: 'image'`)
   - Show uploaded image preview
   - Optional: width slider (100–800px), alignment (left/center/right)
   - Paste image from clipboard support

3. **Visibility Toggle** (if admin):
   - Radio: `public` or `internal`
   - Internal posts only visible to this admin + their students

4. **Submit Button**:
   - Creates `posts/{newId}` doc with:
     ```
     {
       id: newId,
       authorId: currentUser.uid,
       authorName: currentUser.name,
       content: plainTextFromRichContent,
       richContent: quillDeltaJSON,
       imageUrls: [],  // extracted from richContent or separate
       createdAt: now,
       status: "pending" (for website users) or "approved" (for admins),
       visibility: "public" or "internal",
       likes: 0,
       comments: 0,
       shares: 0,
       views: 0
     }
     ```
   - Notify superAdmins if status is "pending":
     ```
     // Write to notifications for each superAdmin
     db.collection('notifications').doc(newNotifId).set({
       userId: superAdminUid,
       type: "post_submitted",
       title: "New Post Pending Review",
       body: `${authorName} submitted a post for approval`,
       isUrgent: false,
       isRead: false,
       createdAt: now
     })
     ```
   - Show success toast + redirect to `/post/{newId}` or back to feed

**Animations:**
- Editor focus: subtle border glow
- Image upload: progress spinner → success check
- Submit button: loading state spinner

---

### 5. Author Profile Page (`/author/[authorId]`)

**Displays:**
- Large author avatar (resolved from role collections by authorId)
- Author name
- Total post count
- Total engagement score (sum of all likes + comments across all posts)
- Bio (if stored; optional)
- Tab: "Posts" showing all approved posts by this author
- Infinite scroll for posts

**Firestore Queries:**
```
// Get author data (try in order: super_admins, admins, students, guardians)
db.collection('super_admins').doc(authorId).get()
db.collection('admins').doc(authorId).get()
// etc.

// Get author's posts
db.collection('posts')
  .where('authorId', '==', authorId)
  .where('status', '==', 'approved')
  .orderBy('createdAt', 'desc')
  .get()

// Calculate engagement
// client-side: sum all likes + comments + shares across their posts
```

**Animations:**
- Avatar: hover zoom + shadow lift
- Page load: fade-in

---

### 6. Saved Posts Page (`/saved`)

**Requires sign-in.**

- Stream user's saved posts from `feeds_user_only/{uid}.savedPosts` array
- Display as post cards (same as feed)
- Clicking a post → `/post/{postId}`

**Firestore Query:**
```
db.collection('feeds_user_only').doc(currentUserId).get()
// Read .savedPosts array, then fetch each post
Promise.all(savedPosts.map(postId => 
  db.collection('posts').doc(postId).get()
))
```

---

### 7. SuperAdmin Dashboard (`/admin`)

**Only accessible if signed-in user is `superAdmin`.**

#### 7.1 Dashboard Overview (`/admin`)

**Landing page showing real-time stats:**
- Total posts (approved, pending, rejected counts)
- Total users (all roles + feeds_user_only count)
- Total engagement (sum of all likes, comments, shares)
- Pending posts count (badge)
- New feeds_user_only registrations (last 7 days)
- Post approval rate (approved / total submitted)
- Top trending posts (with engagement metrics)
- Recent activity feed (new posts, new users, rejections, etc.)

**Charts (optional, use Chart.js or Recharts):**
- Posts per day (last 30 days bar chart)
- User growth (line chart)
- Engagement trends (line chart)

**Quick Actions:**
- View pending posts
- Manage website users
- View all posts
- View reported content
- Site settings

---

#### 7.2 Pending Posts Management (`/admin/pending`)

**List all `pending` posts waiting for approval.**

**Table/Card Layout:**
- Post ID
- Author (avatar, name, email)
- Content preview (first 150 chars)
- Submitted timestamp (relative time)
- Engagement preview (pre-approval likes/comments)
- Actions (Approve, Reject, View Full Post)

**Firestore Query:**
```
db.collection('posts')
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'asc')
  .get()
```

**Approve Action:**
```javascript
// 1. Update post status
db.collection('posts').doc(postId).update({
  status: 'approved'
})

// 2. Notify author (approved)
db.collection('notifications').doc(newId).set({
  userId: authorId,
  type: 'post_approved',
  title: 'Your Post Approved ✅',
  body: 'Your post has been approved and is now visible to all users',
  isRead: false,
  createdAt: FieldValue.serverTimestamp()
})

// 3. Notify all users (fan-out to feeds_user_only, admins, students, guardians)
const usersRef = [
  db.collection('feeds_user_only'),
  db.collection('admins'),
  db.collection('students'),
  db.collection('guardians')
];

usersRef.forEach(userCollection => {
  userCollection.get().then(snapshot => {
    snapshot.docs.forEach(doc => {
      db.collection('notifications').doc(newNotifId).set({
        userId: doc.id,
        type: 'new_approved_post',
        title: `New Post: ${postTitle}`,
        body: `${authorName} posted something new`,
        postId: postId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp()
      })
    })
  })
})
```

**Reject Action:**
```javascript
// 1. Show rejection reason modal (required)
// Reason can be: "Inappropriate content", "Spam", "Misleading", "Other"

// 2. Update post
db.collection('posts').doc(postId).update({
  status: 'rejected',
  rejectionReason: rejectionReason,
  rejectedAt: FieldValue.serverTimestamp(),
  rejectedBy: currentSuperAdminUid
})

// 3. Notify author (rejected with reason)
db.collection('notifications').doc(newId).set({
  userId: authorId,
  type: 'post_rejected',
  title: 'Post Not Approved ❌',
  body: `Reason: ${rejectionReason}. You can edit and resubmit.`,
  postId: postId,
  rejectionReason: rejectionReason,
  isRead: false,
  createdAt: FieldValue.serverTimestamp()
})
```

**View Full Post:**
- Click to open full post detail modal
- Shows rich content, all images, comments (if any)
- Then approve/reject from modal

---

#### 7.3 Website Users Management (`/admin/users`)

**View and manage all website-only users (`feeds_user_only` collection).**

**Table/Card Layout:**
- User avatar + name
- Email
- Registration date
- Last login
- Post count (how many posts created)
- Status: `active` | `suspended` | `banned`
- Actions (View Profile, Suspend, Ban, Delete)

**Firestore Query:**
```javascript
db.collection('feeds_user_only')
  .orderBy('createdAt', 'desc')
  .get()
```

**Filters:**
- By registration date range
- By status (active, suspended, banned)
- By post count (high/medium/low contributors)
- Search by name or email

**User Profile Card (`/admin/users/{userId}`):**
- Full profile (name, email, avatar, joinDate, lastLogin)
- Statistics:
  - Posts created
  - Total likes received
  - Total comments received
  - Engagement score
- All posts by this user (paginated)
- Comments/replies by this user
- Account activity timeline
- Actions: Suspend, Ban, Delete Account

**Suspend User:**
```javascript
db.collection('feeds_user_only').doc(userId).update({
  status: 'suspended',
  suspendedAt: FieldValue.serverTimestamp(),
  suspendedBy: currentSuperAdminUid,
  suspendReason: reason // "Spam", "Harassment", "Violation", etc.
})

// User receives notification
db.collection('notifications').doc(newId).set({
  userId: userId,
  type: 'account_suspended',
  title: 'Account Suspended',
  body: `Your account has been suspended. Reason: ${reason}. Contact support to appeal.`,
  isUrgent: true,
  isRead: false,
  createdAt: FieldValue.serverTimestamp()
})

// Hidden from feed and cannot post/comment
// On app login: show suspension notice with appeal option
```

**Ban User:**
```javascript
db.collection('feeds_user_only').doc(userId).update({
  status: 'banned',
  bannedAt: FieldValue.serverTimestamp(),
  bannedBy: currentSuperAdminUid,
  banReason: reason // "Policy violation", "Repeated violations", etc.
})

// All posts by this user are hidden or deleted
db.collection('posts')
  .where('authorId', '==', userId)
  .get()
  .then(snapshot => {
    snapshot.docs.forEach(doc => {
      doc.ref.update({ status: 'rejected', rejectionReason: 'User banned' })
    })
  })

// User receives notification
db.collection('notifications').doc(newId).set({
  userId: userId,
  type: 'account_banned',
  title: 'Account Banned',
  body: `Your account has been permanently banned. Reason: ${banReason}. You cannot create new posts or comments.`,
  isUrgent: true,
  isRead: false,
  createdAt: FieldValue.serverTimestamp()
})
```

**Delete Account:**
- Soft delete: keep posts, comments (show as "deleted user")
- Hard delete: remove all user data and posts
- Confirm with admin

```javascript
// Soft delete
db.collection('feeds_user_only').doc(userId).update({
  status: 'deleted',
  deletedAt: FieldValue.serverTimestamp(),
  name: '[Deleted User]',
  email: null,
  profileImageUrl: null
})

// Hard delete
// 1. Delete user doc
db.collection('feeds_user_only').doc(userId).delete()

// 2. Delete all posts
db.collection('posts')
  .where('authorId', '==', userId)
  .get()
  .then(snapshot => {
    snapshot.docs.forEach(doc => doc.ref.delete())
  })

// 3. Delete all comments/replies
db.collection('posts').get().then(snapshot => {
  snapshot.docs.forEach(postDoc => {
    postDoc.ref.collection('comments')
      .where('userId', '==', userId)
      .get()
      .then(commentSnapshot => {
        commentSnapshot.docs.forEach(doc => doc.ref.delete())
      })
  })
})

// 4. Remove from saved_posts arrays
db.collection('feeds_user_only').get().then(snapshot => {
  snapshot.docs.forEach(doc => {
    const savedPosts = doc.data().savedPosts || [];
    const updated = savedPosts.filter(postId => {
      // remove posts by deleted user
      // check if post.authorId == userId
    });
    doc.ref.update({ savedPosts: updated })
  })
})
```

---

#### 7.4 All Posts Management (`/admin/posts`)

**View all posts (approved, pending, rejected) with full control.**

**Table/Card Layout:**
- Post ID
- Author (avatar, name)
- Title/preview
- Status badge (approved/pending/rejected)
- Engagement (likes, comments, shares, views)
- Created date
- Actions (View, Edit, Delete, Hide, Unhide)

**Firestore Query:**
```javascript
// All posts with filters
db.collection('posts')
  .orderBy('createdAt', 'desc')
  .get()

// Or with status filter
db.collection('posts')
  .where('status', '==', 'approved')
  .orderBy('createdAt', 'desc')
  .get()
```

**Filters:**
- By status (approved, pending, rejected)
- By visibility (public, internal)
- By date range
- By author
- Search by content/title

**Actions:**

**Hide Post:**
```javascript
// Temporarily hide from feed (keep data)
db.collection('posts').doc(postId).update({
  isHidden: true,
  hiddenAt: FieldValue.serverTimestamp(),
  hiddenBy: currentSuperAdminUid,
  hideReason: reason  // "Inappropriate", "Misleading", etc.
})
```

**Delete Post:**
```javascript
// Soft delete (keep in DB, mark as deleted)
db.collection('posts').doc(postId).update({
  status: 'deleted',
  deletedAt: FieldValue.serverTimestamp(),
  deletedBy: currentSuperAdminUid
})

// Hard delete
db.collection('posts').doc(postId).delete()

// Delete all comments/likes/shares
db.collection('posts').doc(postId)
  .collection('comments').get().then(snap => {
    snap.docs.forEach(doc => doc.ref.delete())
  })
// ... repeat for likes, shares, etc.
```

**Edit Post:**
- Show rich text editor with current content
- Allow changing title, content, images
- Log edit history (who edited, when)

```javascript
db.collection('posts').doc(postId).update({
  content: newContent,
  richContent: newRichContent,
  updatedAt: FieldValue.serverTimestamp(),
  updatedBy: currentSuperAdminUid,
  editHistory: arrayUnion({
    editedAt: FieldValue.serverTimestamp(),
    editedBy: currentSuperAdminUid,
    previousContent: oldContent
  })
})
```

---

#### 7.5 Reported Content (`/admin/reported`)

**Handle user reports of inappropriate posts/comments/users.**

**Collection: `reports` (new)**
```javascript
{
  id: string,
  postId: string | null,  // if reporting a post
  commentId: string | null,
  userId: string | null,  // if reporting a user
  reportedBy: string,     // UID of reporter
  reason: string,         // "Spam", "Harassment", "Inappropriate", etc.
  description: string,    // additional details
  status: "open" | "reviewing" | "resolved" | "dismissed",
  createdAt: Timestamp,
  resolvedAt: Timestamp | null,
  resolution: string | null  // action taken (deleted post, banned user, etc.)
}
```

**Report Form (on post/user pages):**
- Reason dropdown
- Description textarea
- Submit button

**Moderation Interface:**
- List of reports (sorted by date, newest first)
- Filter by status (open, reviewing, resolved)
- Filter by reason
- Each report shows:
  - What's being reported (post/user)
  - Reporter email (optional anonymize)
  - Reason + description
  - Date reported
  - Actions (Dismiss, Review, Resolve)

**Review Report:**
- View the reported content
- View report details
- Decide action: Delete content, Ban user, Suspend user, Dismiss

**Update Status:**
```javascript
db.collection('reports').doc(reportId).update({
  status: 'resolved',
  resolution: 'Post deleted - violated policy',
  resolvedAt: FieldValue.serverTimestamp(),
  resolvedBy: currentSuperAdminUid
})
```

---

#### 7.6 Site Settings (`/admin/settings`)

**Configure website-wide settings.**

**Settings:**

**1. Content Moderation**
- Auto-reject keywords (comma-separated list, case-insensitive)
- Require approval for: Website users? Admins? Both?
- Allow comments? Yes/No
- Allow sharing? Yes/No

**2. User Registration**
- Allow new signups? Yes/No
- Require email verification? Yes/No
- Auto-approve user posts? Yes/No (for admins)

**3. Notifications**
- Email notifications enabled? Yes/No
- FCM push notifications enabled? Yes/No
- Digest frequency (Daily, Weekly, Never)

**4. Branding**
- Site title
- Site description
- Logo URL
- Primary color (hex)
- Secondary color (hex)

**5. Terms & Policies**
- Terms of Service (rich text)
- Privacy Policy (rich text)
- Community Guidelines (rich text)

**6. Spam Protection**
- Enable rate limiting? Yes/No
- Max posts per user per day (default: 10)
- Max comments per user per day (default: 50)

All settings stored in `app_settings/feeds_website` doc:
```javascript
{
  moderationKeywords: string[],
  requireApprovalFor: "all" | "website_users_only" | "none",
  allowComments: boolean,
  allowSharing: boolean,
  allowNewSignups: boolean,
  requireEmailVerification: boolean,
  autoApproveAdminPosts: boolean,
  siteTitle: string,
  siteDescription: string,
  logoUrl: string,
  primaryColor: string,  // hex
  secondaryColor: string,
  termsOfService: string,  // HTML
  privacyPolicy: string,
  communityGuidelines: string,
  enableRateLimiting: boolean,
  maxPostsPerDay: number,
  maxCommentsPerDay: number,
  updatedAt: Timestamp,
  updatedBy: string
}
```

---

#### 7.7 Activity & Audit Logs (`/admin/logs`)

**Track all moderation actions for transparency.**

**Collection: `admin_logs` (new)**
```javascript
{
  id: string,
  adminId: string,           // who performed action
  action: string,            // "approve_post", "reject_post", "ban_user", "delete_post", etc.
  targetId: string,          // postId or userId
  targetType: "post" | "user" | "comment",
  details: object,           // action-specific details
  reason: string | null,
  createdAt: Timestamp
}
```

**Logs Display:**
- Timeline of all admin actions
- Filter by action type (approvals, rejections, bans, etc.)
- Filter by admin
- Filter by date range
- Search by post/user ID

**Example Log Entry:**
```
2026-06-28 14:32:15 | superadmin@example.com | Approved post | post-12345 
  | "High-quality educational content"
```

---

#### 7.8 SuperAdmin Permissions

- ✅ View all posts (approved, pending, rejected)
- ✅ Approve/reject pending posts
- ✅ Hide/delete posts
- ✅ Edit posts
- ✅ View all comments/replies
- ✅ Delete comments/replies
- ✅ View all website users
- ✅ Suspend/ban users
- ✅ Delete user accounts
- ✅ View reported content
- ✅ Resolve reports
- ✅ Configure site settings
- ✅ View analytics/stats
- ✅ View audit logs
- ✅ Cannot create posts (only moderate)
- ❌ Cannot delete other roles' data (admins/students/guardians)

---

#### 7.9 SuperAdmin UI/UX

**Sidebar Navigation:**
- Dashboard (home icon)
- Pending Posts (📋 badge with count)
- All Posts
- Users
- Reported Content
- Settings
- Activity Logs

**Header:**
- Super Admin badge
- Quick stats (pending count, online users)
- Notifications (report submitted, post awaiting approval)
- Profile dropdown (Log out)

**Colors/Styling:**
- Use distinct color scheme (e.g., red/orange for critical actions)
- Danger actions (delete, ban) require confirmation modal
- Success toast on every action
- Error handling with clear messages
- Empty states when no data

**Animations:**
- Moderation action toast: slide-in from top, fade-out after 3s
- Ban/delete confirmation: scale-in modal with shake on error
- Activity timestamp: pulse animation for recent entries (< 5 min ago)
- Badge updates: scale pop animation when count changes

---

## 🎬 Animations & UI Polish

### Framer Motion Examples

```tsx
// Post card fade-in + slide-up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: index * 0.05 }}
>
  {/* card content */}
</motion.div>

// Like button bounce
const [liked, setLiked] = useState(false);
<motion.button
  whileTap={{ scale: 1.2 }}
  transition={{ type: 'spring', stiffness: 200 }}
  onClick={() => setLiked(!liked)}
>
  ❤️
</motion.button>

// Trending badge shimmer
<motion.div
  animate={{ opacity: [0.5, 1, 0.5] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  🔥 Trending
</motion.div>

// Author avatar hover zoom
<motion.img
  whileHover={{ scale: 1.1 }}
  transition={{ duration: 0.2 }}
  src={avatar}
/>

// Comment expand (height transition)
<motion.div
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: 'auto' }}
  transition={{ duration: 0.3 }}
>
  {/* reply form */}
</motion.div>
```

### CSS Animations

```css
/* Image blur-in reveal on load */
.post-image {
  transition: filter 0.6s ease-out;
  filter: blur(10px);
}
.post-image.loaded {
  filter: blur(0);
}

/* Page fade transition */
@keyframes pageIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.page { animation: pageIn 0.4s ease-out; }
```

### Interaction Feedback

- Hover on post card: subtle lift, shadow increase
- Loading spinner during fetch
- Toast notifications (success, error, info)
- Button hover states (opacity, background color change)
- Disabled button states (opacity reduced, cursor disabled)

---

## 🌐 Google Drive Integration

### Purpose
Store post images on Google Drive (same as the Flutter app).

### Setup

1. **OAuth Credentials** (from [Google Cloud Console](https://console.cloud.google.com)):
   - Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URIs: `http://localhost:3000/auth/callback`, `https://yourdomain.com/auth/callback`
   - Copy **Client ID** to environment variables

2. **Google Sign-In Scopes**:
   ```
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   https://www.googleapis.com/auth/drive.file
   ```

### Upload Flow

1. User selects image in create post form
2. Read file as bytes
3. Request Google Drive access token (Firebase provides this after Google Sign-In)
4. POST to Google Drive API:
   ```
   POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
   Authorization: Bearer {accessToken}
   Content-Type: multipart/related

   --boundary
   Content-Type: application/json; charset=UTF-8

   {
     "name": "{fileName}",
     "parents": ["{driveFolderIdOptional}"]
   }

   --boundary
   Content-Type: image/jpeg

   {binary file content}
   ```

5. Response includes `id` and `webViewLink`
6. Construct shareable URL: `https://drive.google.com/uc?id={fileId}`
7. Insert URL into Quill Delta as `image` BlockEmbed

### Fallback
If Google Drive fails or user hasn't granted Drive scope, use Firebase Storage as fallback:
```
firebase.storage().ref(`posts/${postId}/${fileName}`).put(file)
  .then(snapshot => snapshot.ref.getDownloadURL())
  .then(url => insertIntoEditor(url))
```

---

## 🔑 Environment Variables

Create `.env.local` (Next.js) or `.env` (other frameworks):

```env
# Firebase Web Config
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAFsRAX-KPuzmhR4-6pJoxBsjNJYILQuGU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tuition-core-f00c7.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tuition-core-f00c7
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tuition-core-f00c7.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=80817603385
NEXT_PUBLIC_FIREBASE_APP_ID=1:80817603385:web:86f6874e0d9b43d2c77f0a

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID_FROM_GOOGLE_CLOUD.apps.googleusercontent.com

# Optional: Google Drive Folder ID (if organizing uploads)
NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID=optional_folder_id

# Optional: API Base URL if using backend
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

---

## 📊 Firestore Indexes

These indexes should exist in the Firebase project:

| Collection | Fields | Order |
|---|---|---|
| `posts` | `status`, `createdAt` | ASC, DESC |
| `posts` | `status`, `visibility`, `createdAt` | ASC, ASC, DESC |
| `posts` | `authorId`, `status`, `createdAt` | ASC, ASC, DESC |
| `notifications` | `userId`, `createdAt` | ASC, DESC |
| `notifications` | `userId`, `isUrgent`, `createdAt` | ASC, ASC, DESC |
| `feeds_user_only` | `status`, `createdAt` | ASC, DESC |
| `reports` | `status`, `createdAt` | ASC, DESC |
| `admin_logs` | `createdAt` | DESC |
| `admin_logs` | `adminId`, `createdAt` | ASC, DESC |

**Create these indexes manually in Firebase Console under "Firestore Database" → "Indexes"** if they don't exist.

---

## 🧪 Testing Checklist

### Auth
- [ ] Sign in with Google works
- [ ] New website user creates `feeds_user_only` doc
- [ ] Existing app user is recognized (checks super_admin → admin → student → guardian)
- [ ] Session persists on page reload
- [ ] Sign out clears state

### Feed
- [ ] Latest posts load and stream in real-time
- [ ] Trending posts calculated correctly (top 3 by engagement in 7 days)
- [ ] Top authors list shows top 8
- [ ] Search filters by content + authorName
- [ ] Pagination (infinite scroll or load more)
- [ ] Stats show correct counts

### Post Detail
- [ ] Quill Delta renders as HTML correctly (formatting, lists, code blocks)
- [ ] Images display
- [ ] Like/unlike works and updates counter
- [ ] Comments load and stream
- [ ] Can submit new comment
- [ ] Can reply to comment
- [ ] Can like/unlike comment
- [ ] View count increments once per user

### Create Post
- [ ] Rich text editor works (all toolbar buttons)
- [ ] Image upload works (Google Drive)
- [ ] Paste image from clipboard works
- [ ] For website users: status saved as "pending", visibility forced to "public"
- [ ] For admins: can choose visibility
- [ ] Submit notification sent to superAdmins for "pending" posts

### Save Posts
- [ ] Bookmark button adds/removes from `savedPosts`
- [ ] Saved posts page shows correct list
- [ ] Links to post detail work

### Author Profile
- [ ] Author avatar loads
- [ ] Engagement score calculated correctly
- [ ] All posts listed

### SuperAdmin Dashboard
- [ ] Dashboard loads with stats (total posts, users, engagement)
- [ ] Charts render correctly (posts/day, user growth)
- [ ] Quick action buttons work (pending posts, user management)

### Moderation: Pending Posts
- [ ] Pending posts list appears with correct info
- [ ] Approve sets status to "approved", notifies author
- [ ] Approve notifies all users of new approved post
- [ ] Reject shows reason prompt
- [ ] Reject saves reason and notifies author
- [ ] View full post modal works
- [ ] Page inaccessible if not superAdmin

### Moderation: Website Users
- [ ] All feeds_user_only users listed with stats
- [ ] Search/filter by name, email, status works
- [ ] User profile page shows correct data
- [ ] Suspend user: status updated, user notified
- [ ] Suspended user cannot post/comment
- [ ] Ban user: status updated, posts hidden
- [ ] Banned user receives notification
- [ ] Delete account (soft): user marked [Deleted User]
- [ ] Delete account (hard): all data removed

### Moderation: All Posts
- [ ] View all posts with filters (status, date, author)
- [ ] Hide post: post hidden from feed
- [ ] Delete post: soft/hard delete works
- [ ] Edit post: content updated, history logged
- [ ] Search posts by content/title works

### Moderation: Reported Content
- [ ] User can report post/user with reason
- [ ] Report appears in admin dashboard
- [ ] Resolve report: status updated
- [ ] Filter reports by status/reason works
- [ ] Resolved actions (delete, ban) applied

### SuperAdmin Settings
- [ ] All settings load correctly
- [ ] Can update moderation settings
- [ ] Can update branding settings
- [ ] Can update content policies
- [ ] Changes save to Firestore
- [ ] Rate limiting enforced (if enabled)

### Audit Logs
- [ ] All admin actions logged
- [ ] Activity timeline displays correctly
- [ ] Filter by action type works
- [ ] Filter by admin works
- [ ] Logs exportable (optional CSV download)

### Mobile Responsiveness
- [ ] Feed readable on mobile
- [ ] Image upload works on mobile
- [ ] Comments readable and reply form fits
- [ ] Post card actions (like, save) accessible

---

## 🚀 Deployment

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

### Vercel (for Next.js)
1. Push to GitHub
2. Connect Vercel to GitHub repo
3. Set environment variables in Vercel dashboard
4. Auto-deploys on push

### Custom Domain
- Point DNS to Firebase Hosting or Vercel
- SSL certificate auto-provisioned

---

## 🔄 Data Flow Diagram

```
Website User Signs In
  ↓
Firebase Auth (Google OAuth)
  ↓
Check Role Collections:
  1. super_admins
  2. admins
  3. students
  4. guardians
  5. feeds_user_only
  (none found) → Create feeds_user_only
  ↓
Store in Zustand/React Query
  ↓
Load Feed:
  - Query posts (approved, public)
  - Stream likes, comments, shares per post
  - Fetch author photos from role collections
  ↓
User Interactions:
  - Like/comment → Firestore transaction
  - Create post → Write to posts, notify superAdmins
  - Upload image → Google Drive API
  ↓
If User Later Joins App:
  - App detects feeds_user_only doc
  - Migrates to admin/student/guardian
  - Deletes feeds_user_only
```

---

## 🐛 Common Issues & Solutions

### Images Not Loading
- Verify Google Drive scope (`drive.file`) requested during sign-in
- Check image URLs are publicly accessible (check Drive file sharing)
- Fallback to Firebase Storage if Drive fails

### Rich Text Not Rendering
- Verify Quill Delta JSON is valid
- Check that all embed types (image, link, code) are handled
- Use Quill's `convertDeltaToHtml` library for HTML conversion

### Comments Not Appearing
- Verify Firestore rules allow read/write to comments subcollection
- Check that post ID in URL matches Firestore doc ID
- Ensure comments stream is listening (not one-time fetch)

### Sign-In Popup Blocked
- Ensure sign-in is triggered by user gesture (click, not auto)
- Check browser popup settings

### Slow Initial Load
- Paginate posts (load 20 at a time, fetch more on scroll)
- Lazy-load images (Intersection Observer)
- Cache author photos in state (don't re-fetch per post)

---

## 📚 Reference Links

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Query Guide](https://firebase.google.com/docs/firestore/query-data/queries)
- [Quill.js Docs](https://quilljs.com/docs)
- [Google Drive API](https://developers.google.com/drive/api)
- [Framer Motion](https://www.framer.com/motion/)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 🔒 Firestore Security Rules

**Protect collections with role-based access control.**

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function: check if user is superAdmin
    function isSuperAdmin(uid) {
      return exists(/databases/$(database)/documents/super_admins/$(uid));
    }
    
    // Helper function: check user role from metadata
    function getUserRole(uid) {
      return get(/databases/$(database)/documents/users_metadata/$(uid)).data.role;
    }
    
    // ===== POSTS =====
    match /posts/{postId} {
      // Anyone can read approved public posts
      allow read: if 
        resource.data.status == 'approved' && 
        resource.data.visibility == 'public';
      
      // Authenticated users can read approved posts
      allow read: if request.auth != null && resource.data.status == 'approved';
      
      // Only superAdmin can read/manage pending/rejected posts
      allow read, update, delete: if request.auth != null && isSuperAdmin(request.auth.uid);
      
      // Anyone authenticated can create (goes to pending)
      allow create: if request.auth != null;
      
      // Author can update their own pending posts
      allow update: if 
        request.auth != null && 
        resource.data.authorId == request.auth.uid &&
        resource.data.status == 'pending';
      
      // Likes subcollection
      match /likes/{userId} {
        allow read: if request.auth != null;
        allow write: if request.auth.uid == userId;
        allow delete: if request.auth.uid == userId;
      }
      
      // Comments subcollection
      match /comments/{commentId} {
        allow read: if true;  // public read
        allow create: if request.auth != null;
        allow update, delete: if 
          request.auth.uid == resource.data.userId ||
          isSuperAdmin(request.auth.uid);
        
        // Replies
        match /replies/{replyId} {
          allow read: if true;
          allow create: if request.auth != null;
          allow update, delete: if 
            request.auth.uid == resource.data.userId ||
            isSuperAdmin(request.auth.uid);
          
          match /likes/{userId} {
            allow read: if request.auth != null;
            allow write: if request.auth.uid == userId;
          }
        }
      }
      
      // Viewers (view tracking)
      match /viewers/{userId} {
        allow read: if isSuperAdmin(request.auth.uid);
        allow write: if request.auth.uid == userId;
      }
      
      // Shares
      match /shares/{shareId} {
        allow read: if isSuperAdmin(request.auth.uid);
        allow write: if request.auth != null;
      }
    }
    
    // ===== FEEDS_USER_ONLY =====
    match /feeds_user_only/{userId} {
      // Users can only read/write their own document
      allow read: if request.auth.uid == userId;
      allow update: if 
        request.auth.uid == userId && 
        request.resource.data.role == 'feeds_user';
      
      // SuperAdmin can read/update all
      allow read, update: if isSuperAdmin(request.auth.uid);
      
      // Prevent deletion of own account (only soft-delete via update)
      allow delete: if isSuperAdmin(request.auth.uid);
    }
    
    // ===== NOTIFICATIONS =====
    match /notifications/{notifId} {
      // Users can read their own notifications
      allow read: if request.auth.uid == resource.data.userId;
      
      // Users can update their own (mark as read)
      allow update: if request.auth.uid == resource.data.userId;
      
      // SuperAdmin can write notifications (system notifications)
      allow write: if isSuperAdmin(request.auth.uid);
    }
    
    // ===== REPORTS =====
    match /reports/{reportId} {
      // Users can create reports
      allow create: if request.auth != null;
      
      // Users can only view their own reports
      allow read: if 
        request.auth.uid == resource.data.reportedBy ||
        isSuperAdmin(request.auth.uid);
      
      // Only superAdmin can update/resolve reports
      allow update, delete: if isSuperAdmin(request.auth.uid);
    }
    
    // ===== ADMIN_LOGS =====
    match /admin_logs/{logId} {
      // Only superAdmin can read/write logs
      allow read, write: if isSuperAdmin(request.auth.uid);
    }
    
    // ===== APP_SETTINGS =====
    match /app_settings/{document=**} {
      // Anyone can read (public configuration)
      allow read: if true;
      
      // Only superAdmin can write
      allow write: if isSuperAdmin(request.auth.uid);
    }
    
    // ===== USERS_METADATA =====
    match /users_metadata/{userId} {
      // Users can read their own metadata
      allow read: if request.auth.uid == userId;
      
      // SuperAdmin can read/write all
      allow read, write: if isSuperAdmin(request.auth.uid);
      
      // Users can update limited fields (not role)
      allow update: if 
        request.auth.uid == userId &&
        !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['role', 'selectedRole']);
    }
    
    // ===== Other collections =====
    match /{document=**} {
      allow read, write: if false;  // deny by default
    }
  }
}
```

**Key Rules:**
- `posts`: Approved public posts visible to all; pending/rejected only to superAdmin
- `feeds_user_only`: Users see only their own; superAdmin sees all
- `notifications`: Users see only their own
- `reports`: Users create; superAdmin reviews
- `admin_logs`: SuperAdmin only
- `app_settings`: Public read; superAdmin write

---

## 📝 Notes

- **Public vs. Internal**: Website users see only `visibility === 'public'` posts. Internal posts are app-only.
- **Migration**: When a website user becomes an app user, migration is automatic via Flutter app login.
- **Moderation**: Website users' posts require superAdmin approval before appearing in feed.
- **Google Drive**: Same account/scope as the Flutter app — shared storage.
- **Real-time**: Use Firestore streams for feed, comments, notifications (not one-time queries).

---

---

## ☁️ Cloud Functions (Optional but Recommended)

**Automate moderation tasks and notifications via Firebase Cloud Functions.**

### 1. Notify Audience on Post Approval

**Trigger**: `posts` document updated with `status: 'approved'`

```javascript
// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const notifyAudienceOnPostApproval = functions.firestore
  .document('posts/{postId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if status changed to approved
    if (before?.status !== 'approved' && after?.status === 'approved') {
      const postId = change.after.id;
      const postData = after;
      
      // Get all users to notify
      const usersToNotify = [];
      
      // Public posts: notify all users
      if (postData.visibility === 'public') {
        const [feedsUsers, admins, students, guardians] = await Promise.all([
          db.collection('feeds_user_only').get(),
          db.collection('admins').get(),
          db.collection('students').get(),
          db.collection('guardians').get()
        ]);
        
        feedsUsers.docs.forEach(d => usersToNotify.push(d.id));
        admins.docs.forEach(d => usersToNotify.push(d.id));
        students.docs.forEach(d => usersToNotify.push(d.id));
        guardians.docs.forEach(d => usersToNotify.push(d.id));
      } 
      // Internal posts: notify admin + their students
      else if (postData.visibility === 'internal') {
        usersToNotify.push(postData.adminId);
        
        const adminStudents = await db.collection('students')
          .where('adminId', '==', postData.adminId)
          .get();
        adminStudents.docs.forEach(d => usersToNotify.push(d.id));
      }
      
      // Create notifications
      const batch = db.batch();
      usersToNotify.forEach(userId => {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          userId: userId,
          type: 'new_approved_post',
          title: `New Post: ${postData.content.substring(0, 50)}...`,
          body: `${postData.authorName} posted something new`,
          postId: postId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`Notified ${usersToNotify.length} users of new approved post`);
    }
  });
```

### 2. Auto-Reject Inappropriate Posts

**Trigger**: `posts` document created or updated

```javascript
export const autoRejectInappropriatePosts = functions.firestore
  .document('posts/{postId}')
  .onCreate(async (snap) => {
    const postData = snap.data();
    const postId = snap.id;
    
    // Get moderation keywords from settings
    const settings = await db.collection('app_settings').doc('feeds_website').get();
    const keywords = settings.data()?.moderationKeywords || [];
    
    const content = postData.content.toLowerCase();
    let foundKeyword = null;
    
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        foundKeyword = keyword;
        break;
      }
    }
    
    if (foundKeyword) {
      // Auto-reject the post
      await snap.ref.update({
        status: 'rejected',
        rejectionReason: `Automatically rejected: Contains moderated keyword "${foundKeyword}"`,
        autoRejectedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Notify author
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        userId: postData.authorId,
        type: 'post_auto_rejected',
        title: 'Post Auto-Rejected',
        body: `Your post was automatically rejected. Reason: ${foundKeyword}`,
        postId: postId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Auto-rejected post ${postId} for keyword "${foundKeyword}"`);
    }
  });
```

### 3. Log Admin Actions

**Trigger**: Any moderation action (approve, reject, ban, delete)

```javascript
export const logAdminAction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
  }
  
  const uid = context.auth.uid;
  
  // Verify user is superAdmin
  const userDoc = await db.collection('super_admins').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User is not a superAdmin');
  }
  
  // Create log entry
  const logRef = db.collection('admin_logs').doc();
  await logRef.set({
    adminId: uid,
    action: data.action,  // "approve_post", "reject_post", "ban_user", etc.
    targetId: data.targetId,
    targetType: data.targetType,  // "post", "user", "comment"
    details: data.details || {},
    reason: data.reason || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`Admin action logged: ${data.action} by ${uid}`);
  return { success: true, logId: logRef.id };
});
```

### 4. Delete User and Cascade Data

**Trigger**: Manual Cloud Function call (via admin panel)**

```javascript
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
  }
  
  const superAdminId = context.auth.uid;
  const targetUserId = data.userId;
  const hardDelete = data.hardDelete || false;
  
  // Verify superAdmin
  const superAdminDoc = await db.collection('super_admins').doc(superAdminId).get();
  if (!superAdminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only superAdmins can delete users');
  }
  
  if (hardDelete) {
    // Hard delete: remove all user data
    const batch = db.batch();
    
    // 1. Delete user doc
    batch.delete(db.collection('feeds_user_only').doc(targetUserId));
    
    // 2. Delete all posts by user
    const userPosts = await db.collection('posts')
      .where('authorId', '==', targetUserId)
      .get();
    userPosts.docs.forEach(doc => batch.delete(doc.ref));
    
    // 3. Delete all comments by user
    const allPosts = await db.collection('posts').get();
    for (const postDoc of allPosts.docs) {
      const comments = await postDoc.ref.collection('comments')
        .where('userId', '==', targetUserId)
        .get();
      comments.docs.forEach(doc => batch.delete(doc.ref));
    }
    
    // 4. Remove from others' saved_posts
    const savedByOthers = await db.collection('feeds_user_only').get();
    for (const userDoc of savedByOthers.docs) {
      const savedPosts = userDoc.data().savedPosts || [];
      const updated = savedPosts.filter(postId => {
        // only keep posts not by deleted user
        // In production, query each post to check authorId
        return true;
      });
      batch.update(userDoc.ref, { savedPosts: updated });
    }
    
    await batch.commit();
    console.log(`Hard-deleted user ${targetUserId} and all their data`);
  } else {
    // Soft delete: mark account as deleted
    await db.collection('feeds_user_only').doc(targetUserId).update({
      status: 'deleted',
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      name: '[Deleted User]',
      email: null,
      profileImageUrl: null
    });
    
    console.log(`Soft-deleted user ${targetUserId}`);
  }
  
  // Log the action
  const logRef = db.collection('admin_logs').doc();
  await logRef.set({
    adminId: superAdminId,
    action: hardDelete ? 'hard_delete_user' : 'soft_delete_user',
    targetId: targetUserId,
    targetType: 'user',
    details: { hardDelete },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { success: true };
});
```

### 5. Cleanup Soft-Deleted Content

**Trigger**: Daily scheduled Cloud Function (via Cloud Scheduler)**

```javascript
export const cleanupSoftDeletedContent = functions.pubsub
  .schedule('0 2 * * *')  // 2 AM daily
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Delete soft-deleted posts older than 30 days
    const oldDeletedPosts = await db.collection('posts')
      .where('status', '==', 'deleted')
      .where('deletedAt', '<', thirtyDaysAgo)
      .get();
    
    const batch = db.batch();
    oldDeletedPosts.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log(`Cleaned up ${oldDeletedPosts.docs.length} soft-deleted posts`);
  });
```

### Deployment

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize functions
cd functions
npm install

# Deploy
firebase deploy --only functions
```

---

**Last Updated**: 2026-06-28
