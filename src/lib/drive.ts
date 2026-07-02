async function uploadRawToDrive(
  file: File,
  accessToken: string,
  folderId?: string
): Promise<string /* Drive file id */> {
  const metadata = {
    name: `${Date.now()}_${file.name}`,
    mimeType: file.type,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );

  if (uploadRes.status === 401) throw new Error("Drive token expired. Please reconnect Google Drive from your profile.");
  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${uploadRes.statusText}`);
  const { id } = await uploadRes.json();

  // Make file publicly readable — throws if this fails so the caller knows
  const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!permRes.ok) throw new Error(`Failed to set Drive file public: ${permRes.statusText}`);

  return id;
}

export async function uploadToDrive(
  file: File,
  accessToken: string,
  folderId?: string
): Promise<string> {
  const id = await uploadRawToDrive(file, accessToken, folderId);
  // lh3.googleusercontent.com/d/{id} is Google's image CDN URL for Drive files.
  // It serves the file directly to anyone without auth when role=reader/type=anyone is set.
  // Only reliable for images — use uploadFile() below for non-image attachments.
  return `https://lh3.googleusercontent.com/d/${id}`;
}

export async function uploadImage(
  file: File,
  accessToken: string | null,
  postId: string
): Promise<string> {
  if (!accessToken) {
    throw new Error("Google Drive not connected. Please sign out and sign in again.");
  }
  const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || undefined;
  return uploadToDrive(file, accessToken, folderId);
}

// For non-image file attachments (PDF, Word, Excel, PowerPoint, text). Returns
// Drive's own viewer URL, which opens Google's native in-browser preview —
// unlike the lh3 image CDN used by uploadToDrive/uploadImage, this reliably
// serves arbitrary file types.
export async function uploadFile(
  file: File,
  accessToken: string | null,
  postId: string
): Promise<{ url: string; id: string }> {
  if (!accessToken) {
    throw new Error("Google Drive not connected. Please sign out and sign in again.");
  }
  const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || undefined;
  const id = await uploadRawToDrive(file, accessToken, folderId);
  return { url: `https://drive.google.com/file/d/${id}/view`, id };
}
