import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Carries the RichTextEditor's custom "imgAlign" delta attribute (set via
// data-align on the image blot, see components/RichTextEditor.tsx) through
// to the rendered <img data-align="..."> so both the live post view and the
// edit-page prefill (which re-parses this HTML back into Quill) see the same
// alignment. Pair with the `.article-body img[data-align="..."]` CSS rules.
export function quillImageAlignTagAttributes(op: any): Record<string, string> | void {
  if (op.isImage?.() && op.attributes?.imgAlign) {
    return { "data-align": op.attributes.imgAlign };
  }
}

export function toDate(ts: Timestamp | Date | undefined | null): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  return ts;
}

export function relativeTime(ts: Timestamp | Date | undefined | null): string {
  try {
    return formatDistanceToNow(toDate(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

export function formatDate(ts: Timestamp | Date | undefined | null): string {
  try {
    return format(toDate(ts), "MMM d, yyyy");
  } catch {
    return "";
  }
}

export function formatDateTime(ts: Timestamp | Date | undefined | null): string {
  try {
    return format(toDate(ts), "MMM d, yyyy HH:mm");
  } catch {
    return "";
  }
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "…";
}

export function extractPlainText(richContent: string | null, fallback: string): string {
  if (!richContent) return fallback;
  try {
    const delta = JSON.parse(richContent);
    if (!delta.ops) return fallback;
    return delta.ops
      .map((op: { insert?: string }) =>
        typeof op.insert === "string" ? op.insert : ""
      )
      .join("")
      .trim();
  } catch {
    return fallback;
  }
}

export function isRecentEntry(ts: Timestamp | Date | undefined | null): boolean {
  const date = toDate(ts);
  return Date.now() - date.getTime() < 5 * 60 * 1000;
}

export function readingTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Extract the first image URL from a post's imageUrls array, richContent HTML, or Quill Delta JSON. */
export function extractFirstImage(imageUrls?: string[], richContent?: string | null): string | null {
  // 1. Prefer the dedicated array
  if (imageUrls && imageUrls.length > 0) return imageUrls[0];
  if (!richContent) return null;

  // 2. Try Quill Delta JSON
  try {
    const delta = JSON.parse(richContent);
    if (Array.isArray(delta.ops)) {
      for (const op of delta.ops) {
        if (typeof op.insert?.image === "string" && !op.insert.image.startsWith("data:")) {
          return op.insert.image;
        }
      }
    }
  } catch {}

  // 3. Try HTML <img src="...">
  const match = richContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];

  return null;
}
