"use client";

import { useEffect } from "react";
import { onAuthStateChanged, OAuthCredential } from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resolveUserRole, createFeedsUser, updateLastLogin } from "@/lib/auth";
import { useStore } from "@/store/useStore";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FeedsUser, AppUser } from "@/types";
import { getStoredDriveToken, getValidDriveToken, isDriveTokenExpired, silentRefreshDriveToken } from "@/lib/driveAuth";

export function useAuth() {
  const { setUser, setAuthLoading, reset } = useStore();

  useEffect(() => {
    setAuthLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        reset();
        return;
      }

      try {
        const { role, userData } = await resolveUserRole(firebaseUser.uid);

        const colMap: Record<string, string> = {
          superAdmin: "super_admins",
          admin: "admins",
          student: "students",
          guardian: "guardians",
          feeds_user: "feeds_user_only",
        };

        // If no userData found (new user), create feeds_user doc
        let resolvedData: FeedsUser | AppUser;
        if (Object.keys(userData).length === 0 && role === "feeds_user") {
          resolvedData = await createFeedsUser(firebaseUser);
        } else if (role === "feeds_user") {
          // resolveUserRole already fetched the doc — reuse the data, no second read
          resolvedData = { id: firebaseUser.uid, ...userData } as FeedsUser;
        } else {
          const snap = await getDoc(doc(db, colMap[role], firebaseUser.uid));
          resolvedData = { id: firebaseUser.uid, role, ...snap.data() } as AppUser;
        }

        // Sync Google profile photo into Firestore if missing or stale
        const storedPhoto =
          (resolvedData as any).profileImageUrl ??
          (resolvedData as any).photoUrl ??
          (resolvedData as any).photoURL;
        const googlePhoto = firebaseUser.photoURL;
        if (googlePhoto && storedPhoto !== googlePhoto) {
          // Update Firestore non-blocking so sign-in isn't delayed
          updateDoc(doc(db, colMap[role], firebaseUser.uid), {
            profileImageUrl: googlePhoto,
          }).catch(() => {});
          // Apply immediately to local state
          (resolvedData as any).profileImageUrl = googlePhoto;
        }

        // Get Google Drive access token.
        // Use stored token immediately (even if expired) so the UI doesn't flash "disconnected".
        // Then try to silently refresh in background — GIS may not be ready yet at this point
        // so we retry once after a short delay if the first attempt fails.
        let accessToken: string | null = getStoredDriveToken(firebaseUser.uid);
        const uid = firebaseUser.uid;
        (async () => {
          try {
            const fresh = await getValidDriveToken(uid);
            // fresh is null only when a stored token existed but was expired
            // and the silent refresh genuinely failed (revoked access, no
            // Google session, third-party cookies blocked, etc.) — reflect
            // that honestly instead of leaving the stale token in the store,
            // which would show a "Drive connected" badge that's actually dead.
            useStore.getState().setAccessToken(fresh);
          } catch {
            // GIS not loaded yet — retry after 3 s
            setTimeout(async () => {
              try {
                const fresh = await silentRefreshDriveToken(uid);
                useStore.getState().setAccessToken(fresh);
              } catch {
                useStore.getState().setAccessToken(null);
              }
            }, 3000);
          }
        })();

        setUser(firebaseUser, role, resolvedData, accessToken);
        updateLastLogin(firebaseUser.uid, role);

        // Auto-refresh Drive token every 50 minutes in the background
        const refreshInterval = setInterval(async () => {
          if (isDriveTokenExpired(uid)) {
            try {
              const fresh = await silentRefreshDriveToken(uid);
              useStore.getState().setAccessToken(fresh);
            } catch {
              // User may have revoked access, signed out of Google elsewhere, or
              // the browser is blocking the silent flow (third-party cookies) —
              // reflect the real state so the UI shows "disconnected" and offers
              // Reconnect, instead of a stale green badge that fails on next upload.
              useStore.getState().setAccessToken(null);
              clearInterval(refreshInterval);
            }
          }
        }, 50 * 60 * 1000);
      } catch (err) {
        console.error("Error resolving user role:", err);
        reset();
      }
    });

    return () => unsubscribe();
  }, []);
}
