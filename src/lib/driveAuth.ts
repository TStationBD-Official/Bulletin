const tokenKey = (uid: string) => `drive_token_${uid}`;
const expiryKey = (uid: string) => `drive_token_expiry_${uid}`;

// Store token + expiry (55 min window; real expiry is 60 min)
export function storeDriveToken(uid: string, token: string) {
  localStorage.setItem(tokenKey(uid), token);
  localStorage.setItem(expiryKey(uid), String(Date.now() + 55 * 60 * 1000));
}

export function getStoredDriveToken(uid: string): string | null {
  return localStorage.getItem(tokenKey(uid));
}

export function isDriveTokenExpired(uid: string): boolean {
  const expiry = localStorage.getItem(expiryKey(uid));
  if (!expiry) return true;
  return Date.now() > parseInt(expiry, 10);
}

export function clearDriveToken(uid: string) {
  localStorage.removeItem(tokenKey(uid));
  localStorage.removeItem(expiryKey(uid));
}

// Silent refresh using Google Identity Services — no popup shown if user
// is still signed into Google in the browser and hasn't revoked access.
export function silentRefreshDriveToken(uid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const gis = (window as any).google?.accounts?.oauth2;
    if (!clientId || !gis) {
      reject(new Error("Google Identity Services not available"));
      return;
    }
    const client = gis.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response: any) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "No token returned"));
          return;
        }
        storeDriveToken(uid, response.access_token);
        resolve(response.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.message ?? "Token refresh failed")),
    });
    // prompt: '' means silent — no consent screen shown
    client.requestAccessToken({ prompt: "" });
  });
}

// Returns a valid token, refreshing silently if needed.
// Returns null if Drive was never connected or refresh fails after user revoked access.
export async function getValidDriveToken(uid: string): Promise<string | null> {
  const token = getStoredDriveToken(uid);
  if (!token) return null;
  if (!isDriveTokenExpired(uid)) return token;

  try {
    return await silentRefreshDriveToken(uid);
  } catch {
    return null;
  }
}

// Reconnect Drive: tries silent first, only shows account picker if silent fails.
export async function reconnectDrive(uid: string): Promise<string> {
  // 1. Silent attempt — no UI shown if user is still signed into Google
  try {
    const token = await silentRefreshDriveToken(uid);
    return token;
  } catch {
    // Silent failed — fall through to account picker (no consent screen, just account selection)
  }

  // 2. Account picker only (no consent screen) — much less intrusive than full consent
  return new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const gis = (window as any).google?.accounts?.oauth2;
    if (!clientId || !gis) {
      reject(new Error("Google Identity Services not available"));
      return;
    }
    const client = gis.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response: any) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "No token returned"));
          return;
        }
        storeDriveToken(uid, response.access_token);
        resolve(response.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.message ?? "Reconnect failed")),
    });
    // select_account shows account picker but skips the Drive consent screen
    client.requestAccessToken({ prompt: "select_account" });
  });
}
