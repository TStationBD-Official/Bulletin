import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");

// App Check: attaches a verified-client token to Firestore/Storage requests so
// scripted traffic without a real reCAPTCHA-passing browser can be rejected once
// enforcement is turned on in the Firebase Console. Safe no-op until
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY is configured — see .env.example.
// Uses the free classic reCAPTCHA v3 (google.com/recaptcha/admin), not
// reCAPTCHA Enterprise — Enterprise costs money past 10k assessments/month
// and needs a Cloud Billing account, unnecessary for this use case.
if (typeof window !== "undefined") {
  if (process.env.NODE_ENV !== "production") {
    // A fixed token registered in Firebase Console > App Check > Manage debug
    // tokens lets local dev bypass real reCAPTCHA verification. Falls back to
    // `true` (auto-generates a token and logs it to console for one-time
    // registration) if no fixed token is configured yet.
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
