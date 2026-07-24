"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { getPost, resolveAuthor } from "@/lib/firestore";
import { useStore } from "@/store/useStore";
import { Post, AuthorProfile } from "@/types";
import { formatDate, readingTime, extractPlainText, quillImageAlignTagAttributes } from "@/lib/utils";
import { QuillDeltaToHtmlConverter } from "quill-delta-to-html";
import { PageLoader } from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

const TUITIONCORE_URL = "https://tuitioncore.vercel.app/";

// Whether a browser's "Save as PDF" keeps <a href> as a real clickable link
// in the output varies (Chrome/Edge usually do, Firefox often doesn't), and
// even when it works, most PDF viewers give no visual hint a run of text is
// a link destination beyond the underline. For inline links inside the
// article body (e.g. reference links copied in from Wikipedia) the link text
// itself rarely reveals where it points, so print the URL as visible text
// right after each link — guarantees the destination is readable/reachable
// from the exported document no matter what.
function addVisibleLinkUrls(html: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    const note = doc.createElement("span");
    note.textContent = ` (${href})`;
    note.style.fontSize = "0.75em";
    note.style.color = "#2563eb";
    note.style.wordBreak = "break-all";
    a.insertAdjacentElement("afterend", note);
  });
  return doc.body.innerHTML;
}

// superAdmin-only "export to PDF" view — a clean, print-optimized rendering
// of the post (no header/nav/sidebar/buttons) that auto-opens the browser's
// print dialog once all images (and the QR code) have loaded. Choosing
// "Save as PDF" there uses the browser's own print engine, which is what
// gives us perfect font rendering, inline image alignment, and any special/
// math characters typed into the post — all exactly as the browser displays
// them, with zero extra PDF-generation libraries needed for the content itself.
export default function PostPdfPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { userRole } = useStore();

  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (userRole && userRole !== "superAdmin") {
      router.replace(`/post/${postId}`);
    }
  }, [userRole, postId, router]);

  // Force light mode for this view regardless of the site theme — a printed/
  // exported document should always be plain black-on-white, not whatever
  // dark: styling is active elsewhere on the site.
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);

  useEffect(() => {
    QRCode.toDataURL(TUITIONCORE_URL, {
      width: 120,
      margin: 1,
      color: { dark: "#1e293b", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await getPost(postId);
        if (!p) return;
        setPost(p);

        const auth = await resolveAuthor(p.authorId).catch(() => null);
        setAuthor(auth);

        if (p.richContent) {
          try {
            const parsed = JSON.parse(p.richContent);
            const converter = new QuillDeltaToHtmlConverter(parsed.ops ?? [], {
              customTagAttributes: quillImageAlignTagAttributes,
            });
            setHtmlContent(addVisibleLinkUrls(converter.convert()));
          } catch {
            setHtmlContent(`<p>${p.content}</p>`);
          }
        } else {
          setHtmlContent(`<p>${p.content}</p>`);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  // Wait for every image (article body + QR code) to actually finish loading
  // before printing — otherwise anything still in flight prints as a blank box.
  useEffect(() => {
    if (!post || !htmlContent || !qrDataUrl) return;
    const imgs = Array.from(document.querySelectorAll("#pdf-page img")) as HTMLImageElement[];
    const waits = imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
    );
    Promise.all(waits).then(() => {
      setReady(true);
      setTimeout(() => window.print(), 200);
    });
  }, [post, htmlContent, qrDataUrl]);

  if (loading) return <PageLoader />;
  if (!post) return <EmptyState icon="🔍" title="Post not found" />;

  const readMin = readingTime(
    extractPlainText(post.richContent ?? null, post.richContent ?? post.content ?? "")
  );

  return (
    <div id="pdf-page" className="min-h-screen bg-white text-gray-900 px-6 py-10 print:px-0 print:py-0">
      <div className="max-w-[800px] mx-auto">
        {!ready && (
          <p className="text-center text-sm text-gray-400 mb-6 print:hidden">
            Preparing PDF… your browser's print dialog will open automatically — choose
            <span className="font-semibold"> "Save as PDF" </span> as the destination.
          </p>
        )}

        {/* ── TuitionCore letterhead ─────────────────────────── */}
        <div
          className="flex items-center justify-between gap-6 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5 mb-8"
          style={{ breakInside: "avoid" }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <img
              src="/tuitioncore.png"
              alt="TuitionCore"
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Powered by
              </p>
              <p className="text-lg font-black text-gray-900 leading-tight">TuitionCore</p>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Complete attendance, fees & performance management for tutors
              </p>
              <a href={TUITIONCORE_URL} className="text-[13px] text-blue-600 underline">
                {TUITIONCORE_URL}
              </a>
            </div>
          </div>

          {qrDataUrl && (
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <img src={qrDataUrl} alt="Scan to visit TuitionCore" className="w-20 h-20 rounded-md" />
              <p className="text-[10px] text-gray-400 text-center leading-tight">Scan to<br />visit</p>
            </div>
          )}
        </div>

        {/* ── Category + title + byline ──────────────────────── */}
        {post.categoryName && (
          <span
            className="inline-block text-[12px] font-semibold px-3 py-1 rounded-full mb-4"
            style={{
              backgroundColor: (post.categoryColor ?? "#6366f1") + "18",
              color: post.categoryColor ?? "#6366f1",
            }}
          >
            {post.categoryIcon ?? "📌"} {post.categoryName}
          </span>
        )}

        {post.title && (
          <h1 className="text-3xl font-black text-gray-900 leading-tight tracking-tight mb-4">
            {post.title}
          </h1>
        )}

        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-200">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {author?.profileImageUrl ? (
              <img src={author.profileImageUrl} alt={author.name} className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div>
            <p className="font-bold text-gray-900">{post.authorName}</p>
            <p className="text-sm text-gray-500">
              {formatDate(post.createdAt)} · {readMin} min read
            </p>
          </div>
        </div>

        {/* ── Article body ────────────────────────────────────── */}
        <div
          id="pdf-article"
          className="article-body pdf-body"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* ── Attachments ─────────────────────────────────────── */}
        {post.fileAttachments && post.fileAttachments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Attachments</p>
            {/* Not an icon-only clickable box — that relies on a clickable <a>
                surviving the print/PDF export, which not every browser's
                "Save as PDF" preserves (Firefox in particular often drops it).
                Printing the raw URL as visible text guarantees the file is
                reachable from the exported document regardless of viewer. */}
            <div className="space-y-3">
              {post.fileAttachments.map((f, i) => (
                <div key={i} style={{ breakInside: "avoid" }}>
                  <p className="font-semibold text-gray-900">{f.name}</p>
                  <a href={f.url} className="text-sm text-blue-600 underline break-all">
                    {f.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="mt-12 pt-5 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
          <span>Exported from The Net Chronicle · {formatDate(new Date())}</span>
          <span>{TUITIONCORE_URL}</span>
        </div>
      </div>
    </div>
  );
}
