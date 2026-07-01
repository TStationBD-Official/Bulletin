import { Timestamp } from "firebase/firestore";

export type UserRole =
  | "superAdmin"
  | "admin"
  | "student"
  | "guardian"
  | "feeds_user";

export type PostStatus = "pending" | "approved" | "rejected" | "deleted";
export type PostVisibility = "public" | "internal";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type UserStatus = "active" | "suspended" | "banned" | "deleted";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  postCount: number;
  isDefault: boolean;
  isActive: boolean;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  richContent: string | null;
  imageUrls: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  status: PostStatus;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  visibility: PostVisibility;
  adminId?: string | null;
  // For internal posts: the admin's UID whose circle (admin + their students/guardians) can see this
  adminGroupId?: string;
  rejectionReason?: string | null;
  isHidden?: boolean;
  hiddenAt?: Timestamp;
  hiddenBy?: string;
  hideReason?: string;
  deletedAt?: Timestamp;
  deletedBy?: string;
  updatedBy?: string;
  editHistory?: EditHistoryEntry[];
  // Category fields (optional — old posts fall back to "General")
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  // Title (optional — old posts without title just show content preview)
  title?: string;
}

export interface EditHistoryEntry {
  editedAt: Timestamp;
  editedBy: string;
  previousContent: string;
}

export interface PostLike {
  userId: string;
  likedAt: Timestamp;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  replies: number;
  createdAt: Timestamp;
}

export interface Reply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  createdAt: Timestamp;
}

export interface FeedsUser {
  id: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
  driveEmail: string | null;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  savedPosts: string[];
  role: "feeds_user";
  status?: UserStatus;
  suspendedAt?: Timestamp;
  suspendedBy?: string;
  suspendReason?: string;
  bannedAt?: Timestamp;
  bannedBy?: string;
  banReason?: string;
  deletedAt?: Timestamp;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
  driveEmail?: string | null;
  role: "superAdmin" | "admin" | "student" | "guardian";
  [key: string]: unknown;
}

export interface UserMetadata {
  uid: string;
  role: UserRole;
  selectedRole: string;
  email: string;
  lastLogin: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isUrgent: boolean;
  isRead: boolean;
  createdAt: Timestamp;
  postId?: string;
  rejectionReason?: string;
}

export interface Report {
  id: string;
  postId: string | null;
  commentId: string | null;
  userId: string | null;
  reportedBy: string;
  reporterName?: string | null;
  reason: string;
  description: string;
  postTitle?: string | null;
  status: ReportStatus;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
  resolution: string | null;
  resolvedBy: string | null;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  targetType: "post" | "user" | "comment";
  details: Record<string, unknown>;
  reason: string | null;
  createdAt: Timestamp;
}

export interface AppSettings {
  moderationKeywords: string[];
  requireApprovalFor: "all" | "website_users_only" | "none";
  allowComments: boolean;
  allowSharing: boolean;
  allowNewSignups: boolean;
  requireEmailVerification: boolean;
  autoApproveAdminPosts: boolean;
  siteTitle: string;
  siteDescription: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  termsOfService: string;
  privacyPolicy: string;
  communityGuidelines: string;
  enableRateLimiting: boolean;
  maxPostsPerDay: number;
  maxCommentsPerDay: number;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface AuthorProfile {
  id: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  role: UserRole;
  totalPosts?: number;
  totalEngagement?: number;
}

export interface TrendingPost extends Post {
  engagementScore: number;
  authorProfile?: AuthorProfile;
}

export interface AdminStats {
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  totalFeedsUsers: number;
  totalAdmins: number;
  totalStudents: number;
  totalGuardians: number;
  totalEngagement: number;
  approvalRate: number;
  newRegistrations7Days: number;
}
