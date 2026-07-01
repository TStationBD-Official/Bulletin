import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { UserRole, FeedsUser } from "@/types";

export interface ResolvedUser {
  role: UserRole;
  userData: Record<string, unknown>;
}

const ROLE_COLLECTIONS: Array<{ collection: string; role: UserRole }> = [
  { collection: "super_admins", role: "superAdmin" },
  { collection: "admins", role: "admin" },
  { collection: "students", role: "student" },
  { collection: "guardians", role: "guardian" },
];

export async function resolveUserRole(uid: string): Promise<ResolvedUser> {
  // Check all app role collections first
  for (const { collection, role } of ROLE_COLLECTIONS) {
    const snap = await getDoc(doc(db, collection, uid));
    if (snap.exists()) {
      return { role, userData: snap.data() };
    }
  }

  // Check feeds_user_only (existing website user)
  const feedsSnap = await getDoc(doc(db, "feeds_user_only", uid));
  if (feedsSnap.exists()) {
    return { role: "feeds_user", userData: feedsSnap.data() };
  }

  // New website user — create docs
  return { role: "feeds_user", userData: {} };
}

export async function createFeedsUser(user: User): Promise<FeedsUser> {
  const now = serverTimestamp();
  const feedsUser: Omit<FeedsUser, "createdAt" | "lastLogin"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastLogin: ReturnType<typeof serverTimestamp>;
  } = {
    id: user.uid,
    email: user.email ?? "",
    name: user.displayName ?? "Anonymous",
    profileImageUrl: user.photoURL ?? null,
    driveEmail: user.email ?? null,
    savedPosts: [],
    role: "feeds_user",
    createdAt: now,
    lastLogin: now,
  };

  await Promise.all([
    setDoc(doc(db, "feeds_user_only", user.uid), feedsUser),
    setDoc(doc(db, "users_metadata", user.uid), {
      uid: user.uid,
      role: "feeds_user",
      selectedRole: "feeds_user",
      email: user.email ?? "",
      lastLogin: now,
    }),
  ]);

  return feedsUser as unknown as FeedsUser;
}

export async function updateLastLogin(uid: string, role: UserRole) {
  try {
    const collectionMap: Record<UserRole, string> = {
      superAdmin: "super_admins",
      admin: "admins",
      student: "students",
      guardian: "guardians",
      feeds_user: "feeds_user_only",
    };
    const col = collectionMap[role];
    await Promise.all([
      updateDoc(doc(db, col, uid), { lastLogin: serverTimestamp() }),
      updateDoc(doc(db, "users_metadata", uid), {
        lastLogin: serverTimestamp(),
      }),
    ]);
  } catch {
    // Non-critical — don't block sign-in
  }
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = result.user;
  // Access token for Google Drive API
  const { OAuthProvider } = await import("firebase/auth");
  // Use getIdToken for Firebase; Google OAuth token is in the credential
  return result;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
