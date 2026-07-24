import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
  QuerySnapshot,
  DocumentData,
  startAfter,
  QueryDocumentSnapshot,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Post,
  Comment,
  Reply,
  FeedsUser,
  Notification,
  Report,
  AdminLog,
  AppSettings,
  AuthorProfile,
  UserRole,
  AdminStats,
  FileAttachment,
} from "@/types";

// ─── Author Resolution ────────────────────────────────────────────────────────

const authorCache = new Map<string, AuthorProfile>();

export async function resolveAuthor(authorId: string): Promise<AuthorProfile | null> {
  if (authorCache.has(authorId)) return authorCache.get(authorId)!;

  // Fast path: author_profiles is a single lightweight doc per user
  // (uid/role/name/profileImageUrl), kept up to date on every login — one
  // read instead of probing up to 5 role collections in sequence below.
  // Falls through to the full scan for accounts that haven't logged in
  // since this index was introduced (self-heals on their next login).
  const fastSnap = await getDoc(doc(db, "author_profiles", authorId));
  if (fastSnap.exists()) {
    const data = fastSnap.data();
    const profile: AuthorProfile = {
      id: authorId,
      name: data.name ?? "Unknown",
      email: "",
      profileImageUrl: data.profileImageUrl ?? null,
      role: data.role ?? "feeds_user",
    };
    authorCache.set(authorId, profile);
    return profile;
  }

  const collections: Array<{ name: string; role: UserRole }> = [
    { name: "super_admins", role: "superAdmin" },
    { name: "admins", role: "admin" },
    { name: "students", role: "student" },
    { name: "guardians", role: "guardian" },
    { name: "feeds_user_only", role: "feeds_user" },
  ];

  for (const { name, role } of collections) {
    const snap = await getDoc(doc(db, name, authorId));
    if (snap.exists()) {
      const data = snap.data();
      const profile: AuthorProfile = {
        id: authorId,
        name: data.name ?? "Unknown",
        email: data.email ?? "",
        // Try all common field names used by both the web app and the Flutter app
        profileImageUrl:
          data.profileImageUrl ??
          data.photoUrl ??
          data.photoURL ??
          data.imageUrl ??
          data.avatar ??
          null,
        role,
      };
      authorCache.set(authorId, profile);
      return profile;
    }
  }
  return null;
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export function subscribeToLatestPosts(
  callback: (posts: Post[]) => void,
  opts?: { adminGroupId?: string | null; isSuperAdmin?: boolean },
  pageSize = 20
): () => void {
  let publicPosts: Post[] = [];
  let internalPosts: Post[] = [];

  const emit = () => {
    const seen = new Set<string>();
    const merged = [...publicPosts, ...internalPosts]
      .filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      .slice(0, pageSize);
    callback(merged);
  };

  // Always subscribe to public approved posts
  const publicQuery = query(
    collection(db, "posts"),
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  // Previously this raced a one-off getDocs() alongside the onSnapshot
  // listener below to paint faster — but Firestore bills the onSnapshot's
  // own initial snapshot as a full read too, so that "faster paint" was
  // silently doubling the read cost of every feed page load. onSnapshot's
  // first callback is fast enough on its own; no need to pre-fetch.
  const unsubPublic = onSnapshot(publicQuery, (snap) => {
    publicPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
    emit();
  });

  // No internal access for feeds_user or unauthenticated
  if (!opts?.adminGroupId && !opts?.isSuperAdmin) return unsubPublic;

  let internalQuery;
  if (opts?.isSuperAdmin) {
    // SuperAdmin sees all internal posts — reuses the same (status+visibility+createdAt) composite index
    internalQuery = query(
      collection(db, "posts"),
      where("status", "==", "approved"),
      where("visibility", "==", "internal"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );
  } else {
    // Query by adminGroupId only (single-field index, auto-created by Firestore) — filter status+visibility in JS
    internalQuery = query(
      collection(db, "posts"),
      where("adminGroupId", "==", opts!.adminGroupId),
      limit(pageSize)
    );
  }

  const unsubInternal = onSnapshot(internalQuery, (snap) => {
    internalPosts = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Post))
      .filter((p) => p.status === "approved" && p.visibility === "internal");
    emit();
  });

  return () => { unsubPublic(); unsubInternal(); };
}

// One-time (non-realtime) paginated fetch — used for "load more" style browsing
// where a stable startAfter cursor is needed (doesn't compose with onSnapshot).
export async function getLatestPostsPage(
  pageSize = 10,
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ posts: Post[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const constraints = [
    where("status", "==", "approved"),
    where("visibility", "==", "public"),
    orderBy("createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];
  const snap = await getDocs(query(collection(db, "posts"), ...constraints));
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
}

function engagementScore(p: Post): number {
  return (p.views ?? 0) + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
}

// Approved posts created within the last `days` days, ranked by total engagement.
// Single range filter + orderBy on the same field ("createdAt") — no composite index needed.
async function getTrendingPostsSince(days: number, take = 3): Promise<Post[]> {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const snap = await getDocs(
    query(
      collection(db, "posts"),
      where("status", "==", "approved"),
      where("createdAt", ">=", cutoff),
      orderBy("createdAt", "desc"),
      limit(200)
    )
  );
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
  return posts
    .filter((p) => p.visibility !== "internal")
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, take);
}

export function getWeeklyTrendingPosts(): Promise<Post[]> {
  return getTrendingPostsSince(7);
}

// Related posts for the post detail page: same category, approved + public,
// ranked by engagement, excluding the post being viewed. Single-field query
// (categoryId only) + client-side filter/sort — avoids a categoryId+status+
// visibility composite index.
export async function getRelatedPosts(
  categoryId: string,
  excludePostId: string,
  take = 2
): Promise<Post[]> {
  const snap = await getDocs(
    query(collection(db, "posts"), where("categoryId", "==", categoryId), limit(50))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Post))
    .filter((p) => p.id !== excludePostId && p.status === "approved" && p.visibility === "public")
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, take);
}

export function getMonthlyTrendingPosts(): Promise<Post[]> {
  return getTrendingPostsSince(30);
}

export async function getTopAuthors(): Promise<
  Array<AuthorProfile & { totalEngagement: number; totalPosts: number }>
> {
  const snap = await getDocs(
    query(
      collection(db, "posts"),
      where("status", "==", "approved"),
      where("visibility", "==", "public"),
      limit(200)
    )
  );
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));

  const authorMap = new Map<
    string,
    { engagement: number; posts: number; name: string }
  >();
  for (const post of posts) {
    const existing = authorMap.get(post.authorId) ?? { engagement: 0, posts: 0, name: post.authorName };
    authorMap.set(post.authorId, {
      engagement: existing.engagement + post.likes + post.comments + post.shares,
      posts: existing.posts + 1,
      name: post.authorName,
    });
  }

  const sorted = Array.from(authorMap.entries())
    .sort((a, b) => b[1].engagement - a[1].engagement)
    .slice(0, 8);

  const authors = await Promise.all(
    sorted.map(async ([id, stats]) => {
      // One author's lookup failing (e.g. a permission edge case) shouldn't
      // blank out the whole widget — fall back to the post's own authorName.
      const profile = await resolveAuthor(id).catch(() => null);
      return {
        ...(profile ?? { id, name: stats.name, email: "", profileImageUrl: null, role: "feeds_user" as UserRole }),
        totalEngagement: stats.engagement,
        totalPosts: stats.posts,
      };
    })
  );
  return authors;
}

export async function getPost(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Post;
}

export async function getAuthorPosts(authorId: string): Promise<Post[]> {
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", authorId),
    where("status", "==", "approved"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export async function getMyPosts(authorId: string): Promise<Post[]> {
  // Single-field query (authorId only) + client-side sort, avoids needing a
  // dedicated authorId+createdAt composite index (see checkRateLimit for the
  // same pattern — that index isn't deployed, only authorId+status+createdAt is).
  const q = query(collection(db, "posts"), where("authorId", "==", authorId), limit(200));
  const snap = await getDocs(q);
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
  return posts.sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export async function checkRateLimit(
  userId: string,
  type: "post" | "comment"
): Promise<{ allowed: boolean; remaining: number }> {
  const settings = await getSettings();
  if (!settings?.enableRateLimiting) return { allowed: true, remaining: 999 };

  const maxPerDay = type === "post" ? settings.maxPostsPerDay : settings.maxCommentsPerDay;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Single-field query (authorId only) + client-side date filter, avoids needing
  // a dedicated authorId+createdAt composite index just for rate limiting.
  const q = query(collection(db, "posts"), where("authorId", "==", userId), limit(200));
  const snap = await getDocs(q);
  const count = snap.docs.filter(
    (d) => d.data().createdAt?.toDate?.() >= startOfDay
  ).length;
  return { allowed: count < maxPerDay, remaining: maxPerDay - count };
}

// ─── Create Post ──────────────────────────────────────────────────────────────

export async function createPost(data: {
  authorId: string;
  authorName: string;
  title?: string;
  content: string;
  richContent: string | null;
  imageUrls: string[];
  fileAttachments?: FileAttachment[];
  visibility: "public" | "internal";
  status: "pending" | "approved";
  adminId?: string;
  // For internal posts: the admin's UID that defines who can see this post
  adminGroupId?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
}): Promise<string> {
  const categoryId = data.categoryId || "general";
  const categoryName = data.categoryName || "General";
  const categoryColor = data.categoryColor || "#6366f1";
  const categoryIcon = data.categoryIcon || "📌";

  // Firestore rejects undefined values — strip them before writing
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  const ref = await addDoc(collection(db, "posts"), {
    ...cleanData,
    categoryId,
    categoryName,
    categoryColor,
    categoryIcon,
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    createdAt: serverTimestamp(),
  });

  // Increment category post count (non-blocking)
  updateDoc(doc(db, "categories", categoryId), { postCount: increment(1) }).catch(() => {});

  if (data.status === "pending") {
    await notifySuperAdminsOfNewPost(ref.id, data.authorName);
  }

  return ref.id;
}

// Editing is allowed while a post is "pending" or "rejected" — firestore.rules
// restricts self-updates to those statuses, so this never touches authorId.
// A re-edit always goes back through the same approval decision as a new post
// (autoApproved -> "approved", otherwise back to "pending" for re-review).
export async function updatePost(postId: string, data: {
  authorName: string;
  title?: string;
  content: string;
  richContent: string | null;
  imageUrls: string[];
  fileAttachments?: FileAttachment[];
  visibility: "public" | "internal";
  status: "pending" | "approved";
  adminId?: string;
  adminGroupId?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
}): Promise<void> {
  const categoryId = data.categoryId || "general";
  const categoryName = data.categoryName || "General";
  const categoryColor = data.categoryColor || "#6366f1";
  const categoryIcon = data.categoryIcon || "📌";

  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => v !== undefined && k !== "authorName")
  );

  await updateDoc(doc(db, "posts", postId), {
    ...cleanData,
    categoryId,
    categoryName,
    categoryColor,
    categoryIcon,
    rejectionReason: null,
  });

  if (data.status === "pending") {
    await notifySuperAdminsOfNewPost(postId, data.authorName);
  }
}

async function notifySuperAdminsOfNewPost(postId: string, authorName: string) {
  const snap = await getDocs(query(collection(db, "super_admins"), limit(50)));
  const batch = writeBatch(db);
  snap.docs.forEach((adminDoc) => {
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      userId: adminDoc.id,
      type: "post_submitted",
      title: "New Post Pending Review",
      body: `${authorName} submitted a post for approval`,
      postId,
      isUrgent: false,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// ─── Post Interactions ────────────────────────────────────────────────────────

export async function isPostLiked(postId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "posts", postId, "likes", userId));
  return snap.exists();
}

export async function likePost(postId: string, userId: string) {
  const likeRef = doc(db, "posts", postId, "likes", userId);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(likeRef);
    if (existing.exists()) return;
    tx.set(likeRef, { userId, likedAt: serverTimestamp() });
    tx.update(doc(db, "posts", postId), { likes: increment(1) });
  });
}

export async function unlikePost(postId: string, userId: string) {
  const likeRef = doc(db, "posts", postId, "likes", userId);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(likeRef);
    if (!existing.exists()) return;
    tx.delete(likeRef);
    tx.update(doc(db, "posts", postId), { likes: increment(-1) });
  });
}

export async function trackView(postId: string, userId: string) {
  const viewerRef = doc(db, "posts", postId, "viewers", userId);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(viewerRef);
    if (existing.exists()) return;
    tx.set(viewerRef, { userId, viewedAt: serverTimestamp() });
    tx.update(doc(db, "posts", postId), { views: increment(1) });
  });
}

export async function sharePost(postId: string, userId: string) {
  const shareRef = doc(db, "posts", postId, "shares", userId);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(shareRef);
    if (existing.exists()) return;
    tx.set(shareRef, { userId, sharedAt: serverTimestamp() });
    tx.update(doc(db, "posts", postId), { shares: increment(1) });
  });
}

// ─── Saved Posts ──────────────────────────────────────────────────────────────
// feeds_user accounts keep using feeds_user_only.savedPosts (existing data,
// and that collection allows self-update). Every other role (superAdmin,
// admin, student, guardian) has read-only Firestore rules on its own
// collection, so their saved posts live on users_metadata instead — that
// collection already allows self-update of any field except role/selectedRole,
// so no security rules change is needed.

function savedPostsDocRef(userId: string, role: UserRole) {
  return role === "feeds_user"
    ? doc(db, "feeds_user_only", userId)
    : doc(db, "users_metadata", userId);
}

export async function savePost(userId: string, postId: string, role: UserRole) {
  const ref = savedPostsDocRef(userId, role);
  if (role === "feeds_user") {
    await updateDoc(ref, { savedPosts: arrayUnion(postId) });
  } else {
    await setDoc(ref, { savedPosts: arrayUnion(postId) }, { merge: true });
  }
}

export async function unsavePost(userId: string, postId: string, role: UserRole) {
  const ref = savedPostsDocRef(userId, role);
  if (role === "feeds_user") {
    await updateDoc(ref, { savedPosts: arrayRemove(postId) });
  } else {
    await setDoc(ref, { savedPosts: arrayRemove(postId) }, { merge: true });
  }
}

export async function isPostSaved(postId: string, userId: string, role: UserRole): Promise<boolean> {
  const snap = await getDoc(savedPostsDocRef(userId, role));
  if (!snap.exists()) return false;
  const savedIds: string[] = snap.data().savedPosts ?? [];
  return savedIds.includes(postId);
}

// Just the saved post IDs (cheap — no post doc fetches) for populating a
// feed's bookmark icons without a per-card round trip.
export async function getSavedPostIds(userId: string, role: UserRole): Promise<string[]> {
  const snap = await getDoc(savedPostsDocRef(userId, role));
  if (!snap.exists()) return [];
  return snap.data().savedPosts ?? [];
}

export async function getSavedPosts(userId: string, role: UserRole): Promise<Post[]> {
  const userSnap = await getDoc(savedPostsDocRef(userId, role));
  if (!userSnap.exists()) return [];
  const savedIds: string[] = userSnap.data().savedPosts ?? [];
  if (savedIds.length === 0) return [];
  const posts = await Promise.all(savedIds.map((id) => getPost(id)));
  return posts.filter(Boolean) as Post[];
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getRecentComments(postId: string, count = 3): Promise<Comment[]> {
  const snap = await getDocs(
    query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "desc"),
      limit(count)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void
) {
  const q = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
  });
}

export async function addComment(
  postId: string,
  userId: string,
  userName: string,
  content: string,
  userAvatar?: string | null
): Promise<string> {
  const ref = await addDoc(collection(db, "posts", postId, "comments"), {
    userId,
    userName,
    userAvatar: userAvatar ?? null,
    content,
    likes: 0,
    replies: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), { comments: increment(1) });
  return ref.id;
}

export async function deleteComment(postId: string, commentId: string) {
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
  await updateDoc(doc(db, "posts", postId), { comments: increment(-1) });
}

export async function likeComment(
  postId: string,
  commentId: string,
  userId: string
) {
  const likeRef = doc(db, "posts", postId, "comments", commentId, "likes", userId);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(likeRef);
    if (existing.exists()) {
      tx.delete(likeRef);
      tx.update(doc(db, "posts", postId, "comments", commentId), {
        likes: increment(-1),
      });
    } else {
      tx.set(likeRef, { userId, likedAt: serverTimestamp() });
      tx.update(doc(db, "posts", postId, "comments", commentId), {
        likes: increment(1),
      });
    }
  });
}

// ─── Replies ──────────────────────────────────────────────────────────────────

export async function getReplies(postId: string, commentId: string): Promise<Reply[]> {
  const q = query(
    collection(db, "posts", postId, "comments", commentId, "replies"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reply));
}

export async function addReply(
  postId: string,
  commentId: string,
  userId: string,
  userName: string,
  content: string,
  userAvatar?: string | null
) {
  await addDoc(
    collection(db, "posts", postId, "comments", commentId, "replies"),
    {
      userId,
      userName,
      userAvatar: userAvatar ?? null,
      content,
      likes: 0,
      createdAt: serverTimestamp(),
    }
  );
  await updateDoc(doc(db, "posts", postId, "comments", commentId), {
    replies: increment(1),
  });
}

export async function deleteReply(
  postId: string,
  commentId: string,
  replyId: string
) {
  await deleteDoc(
    doc(db, "posts", postId, "comments", commentId, "replies", replyId)
  );
  await updateDoc(doc(db, "posts", postId, "comments", commentId), {
    replies: increment(-1),
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function reportContent(data: {
  postId?: string;
  commentId?: string;
  userId?: string;
  reportedBy: string;
  reporterName?: string;
  reason: string;
  description: string;
  postTitle?: string;
}) {
  const reportRef = await addDoc(collection(db, "reports"), {
    postId: data.postId ?? null,
    commentId: data.commentId ?? null,
    userId: data.userId ?? null,
    reportedBy: data.reportedBy,
    reporterName: data.reporterName ?? null,
    reason: data.reason,
    description: data.description,
    postTitle: data.postTitle ?? null,
    status: "open",
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resolution: null,
    resolvedBy: null,
  });

  // Notify all superAdmins of the new report (non-blocking)
  notifySuperAdminsOfReport(
    reportRef.id,
    data.postId ?? null,
    data.reporterName ?? "Someone",
    data.reason,
    data.postTitle ?? null
  ).catch(() => {});
}

async function notifySuperAdminsOfReport(
  reportId: string,
  postId: string | null,
  reporterName: string,
  reason: string,
  postTitle: string | null
) {
  const snap = await getDocs(query(collection(db, "super_admins"), limit(50)));
  const batch = writeBatch(db);
  snap.docs.forEach((adminDoc) => {
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      userId: adminDoc.id,
      type: "report_submitted",
      title: "New Content Report",
      body: `${reporterName} reported ${postTitle ? `"${postTitle}"` : "a post"} for ${reason.toLowerCase()}`,
      postId: postId ?? null,
      reportId,
      isUrgent: true,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function getAllReports(): Promise<Report[]> {
  const snap = await getDocs(
    query(collection(db, "reports"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report));
}

export async function resolveReport(
  reportId: string,
  resolution: string,
  resolvedBy: string
) {
  await updateDoc(doc(db, "reports", reportId), {
    status: "resolved",
    resolution,
    resolvedAt: serverTimestamp(),
    resolvedBy,
  });
}

export async function dismissReport(reportId: string, resolvedBy: string) {
  await updateDoc(doc(db, "reports", reportId), {
    status: "dismissed",
    resolvedAt: serverTimestamp(),
    resolvedBy,
    resolution: "Dismissed",
  });
}

export async function updateReportStatus(
  reportId: string,
  status: "reviewing" | "open"
) {
  await updateDoc(doc(db, "reports", reportId), { status });
}

// Delete a reported post + notify the author + resolve the report
export async function deleteReportedPost(
  postId: string,
  authorId: string,
  adminId: string,
  reportId: string,
  reason: string
): Promise<void> {
  await Promise.all([
    // Soft-delete the post
    updateDoc(doc(db, "posts", postId), {
      status: "deleted",
      deletedAt: serverTimestamp(),
      deletedBy: adminId,
    }),
    // Notify the author
    addDoc(collection(db, "notifications"), {
      userId: authorId,
      type: "post_deleted",
      title: "Your post was removed",
      body: `Your post was removed by a moderator: "${reason}"`,
      postId,
      isUrgent: true,
      isRead: false,
      createdAt: serverTimestamp(),
    }),
    // Resolve the report
    updateDoc(doc(db, "reports", reportId), {
      status: "resolved",
      resolution: `Post deleted — ${reason}`,
      resolvedAt: serverTimestamp(),
      resolvedBy: adminId,
    }),
  ]);
  await logAdminAction({
    adminId,
    action: "delete_reported_post",
    targetId: postId,
    targetType: "post",
    reason,
  });
}

// Warn a post author about their content + mark report as reviewing
export async function warnPostAuthor(
  postId: string,
  authorId: string,
  adminId: string,
  reportId: string,
  message: string
): Promise<void> {
  await Promise.all([
    // Send warning notification to author
    addDoc(collection(db, "notifications"), {
      userId: authorId,
      type: "post_warning",
      title: "Content warning on your post",
      body: message,
      postId,
      isUrgent: true,
      isRead: false,
      createdAt: serverTimestamp(),
    }),
    // Move report to reviewing
    updateDoc(doc(db, "reports", reportId), {
      status: "reviewing",
    }),
  ]);
  await logAdminAction({
    adminId,
    action: "warn_post_author",
    targetId: postId,
    targetType: "post",
    reason: message,
  });
}

// ─── Admin Actions ────────────────────────────────────────────────────────────

export async function logAdminAction(data: {
  adminId: string;
  action: string;
  targetId: string;
  targetType: "post" | "user" | "comment";
  details?: Record<string, unknown>;
  reason?: string;
}) {
  await addDoc(collection(db, "admin_logs"), {
    adminId: data.adminId,
    action: data.action,
    targetId: data.targetId,
    targetType: data.targetType,
    details: data.details ?? {},
    reason: data.reason ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function approvePost(
  postId: string,
  adminId: string,
  categoryOverride?: { categoryId: string; categoryName: string; categoryColor: string; categoryIcon: string }
): Promise<void> {
  const postSnap = await getDoc(doc(db, "posts", postId));
  if (!postSnap.exists()) throw new Error("Post not found");
  const post = postSnap.data();

  const updatePayload: Record<string, unknown> = { status: "approved" };
  if (categoryOverride) {
    updatePayload.categoryId = categoryOverride.categoryId;
    updatePayload.categoryName = categoryOverride.categoryName;
    updatePayload.categoryColor = categoryOverride.categoryColor;
    updatePayload.categoryIcon = categoryOverride.categoryIcon;
  }
  await updateDoc(doc(db, "posts", postId), updatePayload);

  // Notify author
  await addDoc(collection(db, "notifications"), {
    userId: post.authorId,
    type: "post_approved",
    title: "Your Post Approved ✅",
    body: "Your post has been approved and is now visible to all users",
    postId,
    isUrgent: false,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  // Fan-out notifications — fire-and-forget so approval never fails due to notify errors
  const now = Timestamp.now();
  (async () => {
    try {
      const cols = ["feeds_user_only", "admins", "students", "guardians"];
      // Fetch all 4 collections in parallel instead of sequentially
      const snaps = await Promise.all(cols.map((col) => getDocs(collection(db, col))));
      const allUsers = snaps.flatMap((snap) =>
        snap.docs.filter((d) => d.id !== post.authorId)
      );
      for (let i = 0; i < allUsers.length; i += 50) {
        const batch = writeBatch(db);
        allUsers.slice(i, i + 50).forEach((userDoc) => {
          batch.set(doc(collection(db, "notifications")), {
            userId: userDoc.id,
            type: "new_approved_post",
            title: `New Post by ${post.authorName}`,
            body: `${post.authorName} posted something new`,
            postId,
            isRead: false,
            isUrgent: false,
            createdAt: now,
          });
        });
        await batch.commit();
      }
    } catch {
      // notification failure never blocks the approval
    }
  })();

  await logAdminAction({
    adminId,
    action: "approve_post",
    targetId: postId,
    targetType: "post",
    details: { authorId: post.authorId },
  });
}

export async function rejectPost(
  postId: string,
  adminId: string,
  reason: string
) {
  const postSnap = await getDoc(doc(db, "posts", postId));
  if (!postSnap.exists()) throw new Error("Post not found");
  const post = postSnap.data();

  await updateDoc(doc(db, "posts", postId), {
    status: "rejected",
    rejectionReason: reason,
    rejectedAt: serverTimestamp(),
    rejectedBy: adminId,
  });

  await addDoc(collection(db, "notifications"), {
    userId: post.authorId,
    type: "post_rejected",
    title: "Post Not Approved ❌",
    body: `Reason: ${reason}. You can edit and resubmit.`,
    postId,
    rejectionReason: reason,
    isUrgent: false,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await logAdminAction({
    adminId,
    action: "reject_post",
    targetId: postId,
    targetType: "post",
    reason,
    details: { authorId: post.authorId },
  });
}

export async function hidePost(
  postId: string,
  adminId: string,
  reason: string
) {
  await updateDoc(doc(db, "posts", postId), {
    isHidden: true,
    hiddenAt: serverTimestamp(),
    hiddenBy: adminId,
    hideReason: reason,
  });
  await logAdminAction({
    adminId,
    action: "hide_post",
    targetId: postId,
    targetType: "post",
    reason,
  });
}

export async function unhidePost(postId: string, adminId: string) {
  await updateDoc(doc(db, "posts", postId), {
    isHidden: false,
    hiddenAt: null,
    hiddenBy: null,
    hideReason: null,
  });
  await logAdminAction({
    adminId,
    action: "unhide_post",
    targetId: postId,
    targetType: "post",
  });
}

export async function softDeletePost(postId: string, adminId: string) {
  await updateDoc(doc(db, "posts", postId), {
    status: "deleted",
    deletedAt: serverTimestamp(),
    deletedBy: adminId,
  });
  await logAdminAction({
    adminId,
    action: "soft_delete_post",
    targetId: postId,
    targetType: "post",
  });
}

export async function hardDeletePost(postId: string, adminId: string) {
  await deleteDoc(doc(db, "posts", postId));
  await logAdminAction({
    adminId,
    action: "hard_delete_post",
    targetId: postId,
    targetType: "post",
  });
}

export async function editPost(
  postId: string,
  adminId: string,
  updates: { content: string; richContent: string | null }
) {
  const postSnap = await getDoc(doc(db, "posts", postId));
  const oldContent = postSnap.exists() ? postSnap.data().content : "";
  await updateDoc(doc(db, "posts", postId), {
    content: updates.content,
    richContent: updates.richContent,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
    editHistory: arrayUnion({
      editedAt: Timestamp.now(),
      editedBy: adminId,
      previousContent: oldContent,
    }),
  });
  await logAdminAction({
    adminId,
    action: "edit_post",
    targetId: postId,
    targetType: "post",
  });
}

// ─── User Management ──────────────────────────────────────────────────────────

export async function getAllFeedsUsers(): Promise<FeedsUser[]> {
  const snap = await getDocs(
    query(collection(db, "feeds_user_only"), orderBy("createdAt", "desc"), limit(1000))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedsUser));
}

export interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: UserRole;
  status?: string;
  createdAt: Timestamp | null;
  lastLogin?: Timestamp | null;
  totalPosts: number;
}

// O(all posts + all users) — scans the entire posts collection to compute
// per-author counts. Expensive; call sparingly and prefer caching the result
// (e.g. React Query) at call sites rather than re-fetching on every visit.
export async function getAllUsersWithStats(): Promise<UnifiedUser[]> {
  const roleSources: Array<{ col: string; role: UserRole }> = [
    { col: "super_admins",   role: "superAdmin" },
    { col: "admins",         role: "admin"      },
    { col: "students",       role: "student"    },
    { col: "guardians",      role: "guardian"   },
    { col: "feeds_user_only", role: "feeds_user" },
  ];

  // Fetch all role collections + all posts in parallel
  const [postsSnap, ...roleSnaps] = await Promise.all([
    getDocs(query(collection(db, "posts"), where("status", "!=", "deleted"))),
    ...roleSources.map(({ col }) => getDocs(collection(db, col))),
  ]);

  // Build post-count map keyed by authorId
  const postCountMap = new Map<string, number>();
  postsSnap.docs.forEach((d) => {
    const authorId = d.data().authorId as string;
    if (authorId) postCountMap.set(authorId, (postCountMap.get(authorId) ?? 0) + 1);
  });

  // Flatten all users
  const users: UnifiedUser[] = [];
  roleSnaps.forEach((snap, i) => {
    const role = roleSources[i].role;
    snap.docs.forEach((d) => {
      const data = d.data();
      users.push({
        id: d.id,
        name: data.name ?? "Unknown",
        email: data.email ?? "",
        profileImageUrl: data.profileImageUrl ?? null,
        role,
        status: data.status ?? "active",
        createdAt: data.createdAt ?? null,
        lastLogin: data.lastLogin ?? null,
        totalPosts: postCountMap.get(d.id) ?? 0,
      });
    });
  });

  // Sort by createdAt desc (nulls last)
  users.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  return users;
}

export async function suspendUser(
  userId: string,
  adminId: string,
  reason: string
) {
  await updateDoc(doc(db, "feeds_user_only", userId), {
    status: "suspended",
    suspendedAt: serverTimestamp(),
    suspendedBy: adminId,
    suspendReason: reason,
  });

  await addDoc(collection(db, "notifications"), {
    userId,
    type: "account_suspended",
    title: "Account Suspended",
    body: `Your account has been suspended. Reason: ${reason}. Contact support to appeal.`,
    isUrgent: true,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await logAdminAction({
    adminId,
    action: "suspend_user",
    targetId: userId,
    targetType: "user",
    reason,
  });
}

export async function banUser(
  userId: string,
  adminId: string,
  reason: string
) {
  await updateDoc(doc(db, "feeds_user_only", userId), {
    status: "banned",
    bannedAt: serverTimestamp(),
    bannedBy: adminId,
    banReason: reason,
  });

  // Hide all user posts
  const postsSnap = await getDocs(
    query(collection(db, "posts"), where("authorId", "==", userId))
  );
  const batch = writeBatch(db);
  postsSnap.docs.forEach((d) => {
    batch.update(d.ref, { status: "rejected", rejectionReason: "User banned" });
  });
  await batch.commit();

  await addDoc(collection(db, "notifications"), {
    userId,
    type: "account_banned",
    title: "Account Banned",
    body: `Your account has been permanently banned. Reason: ${reason}.`,
    isUrgent: true,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await logAdminAction({
    adminId,
    action: "ban_user",
    targetId: userId,
    targetType: "user",
    reason,
  });
}

export async function softDeleteUser(userId: string, adminId: string) {
  await updateDoc(doc(db, "feeds_user_only", userId), {
    status: "deleted",
    deletedAt: serverTimestamp(),
    name: "[Deleted User]",
    email: null,
    profileImageUrl: null,
  });
  await logAdminAction({
    adminId,
    action: "soft_delete_user",
    targetId: userId,
    targetType: "user",
  });
}

export async function hardDeleteUser(userId: string, adminId: string) {
  // Delete user doc
  await deleteDoc(doc(db, "feeds_user_only", userId));

  // Delete all posts
  const postsSnap = await getDocs(
    query(collection(db, "posts"), where("authorId", "==", userId))
  );
  const batch = writeBatch(db);
  postsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await logAdminAction({
    adminId,
    action: "hard_delete_user",
    targetId: userId,
    targetType: "user",
  });
}

export async function reinstateUser(userId: string, adminId: string) {
  await updateDoc(doc(db, "feeds_user_only", userId), {
    status: "active",
    suspendedAt: null,
    suspendedBy: null,
    suspendReason: null,
  });
  await logAdminAction({
    adminId,
    action: "reinstate_user",
    targetId: userId,
    targetType: "user",
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
    );
  });
}

export async function markNotificationRead(notifId: string) {
  await updateDoc(doc(db, "notifications", notifId), { isRead: true });
}

export async function markAllNotificationsRead(userId: string) {
  const snap = await getDocs(
    query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("isRead", "==", false)
    )
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(doc(db, "app_settings", "feeds_website"));
  if (!snap.exists()) return null;
  return snap.data() as AppSettings;
}

export async function updateSettings(
  settings: Partial<AppSettings>,
  adminId: string
) {
  await setDoc(
    doc(db, "app_settings", "feeds_website"),
    { ...settings, updatedAt: serverTimestamp(), updatedBy: adminId },
    { merge: true }
  );
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Use getCountFromServer for everything except approved posts (need docs for engagement sum)
  const [approved, pendingCount, rejectedCount, feedsCount, adminsCount, studentsCount, guardiansCount, recentCount] =
    await Promise.all([
      getDocs(query(collection(db, "posts"), where("status", "==", "approved"))),
      getCountFromServer(query(collection(db, "posts"), where("status", "==", "pending"))),
      getCountFromServer(query(collection(db, "posts"), where("status", "==", "rejected"))),
      getCountFromServer(collection(db, "feeds_user_only")),
      getCountFromServer(collection(db, "admins")),
      getCountFromServer(collection(db, "students")),
      getCountFromServer(collection(db, "guardians")),
      getCountFromServer(
        query(
          collection(db, "feeds_user_only"),
          where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo))
        )
      ),
    ]);

  let totalEngagement = 0;
  approved.docs.forEach((d) => {
    const p = d.data();
    totalEngagement += (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
  });

  const totalRejected = rejectedCount.data().count;
  const totalSubmitted = approved.size + totalRejected;
  const approvalRate = totalSubmitted > 0 ? approved.size / totalSubmitted : 0;

  return {
    totalApproved: approved.size,
    totalPending: pendingCount.data().count,
    totalRejected,
    totalFeedsUsers: feedsCount.data().count,
    totalAdmins: adminsCount.data().count,
    totalStudents: studentsCount.data().count,
    totalGuardians: guardiansCount.data().count,
    totalEngagement,
    approvalRate,
    newRegistrations7Days: recentCount.data().count,
  };
}

export async function getAdminLogs(limitCount = 50): Promise<AdminLog[]> {
  const snap = await getDocs(
    query(
      collection(db, "admin_logs"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminLog));
}

export async function getAllPostsAdmin(pageLimit = 500): Promise<Post[]> {
  const snap = await getDocs(
    query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(pageLimit))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export function subscribeToPendingCount(callback: (count: number) => void) {
  return onSnapshot(
    query(collection(db, "posts"), where("status", "==", "pending")),
    (snap) => callback(snap.size)
  );
}
