"use client";

import { useEffect, useRef, useState, forwardRef } from "react";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import { uploadImage } from "@/lib/drive";
import { useStore } from "@/store/useStore";
import toast from "react-hot-toast";

// Store the Quill class used for blot registration so applyResize uses the same instance.
let _Quill: any = null;

// Register resizable image blot before react-quill loads (browser-only).
// Must be at module level so it runs once before ReactQuill initialises Quill.
if (typeof window !== "undefined") {
  _Quill = require("quill");
  const Quill = _Quill;

  // ── Font & Size: style-based so values go in as inline styles.
  //    whitelist=null means ANY value (including pasted ones) is accepted —
  //    toolbar still only shows the FONT_LIST/SIZE_LIST options.
  const FontStyle = Quill.import("attributors/style/font");
  FontStyle.whitelist = null;
  Quill.register(FontStyle, true);

  const SizeStyle = Quill.import("attributors/style/size");
  SizeStyle.whitelist = null;
  Quill.register(SizeStyle, true);

  // ── Undo / Redo icons
  const Icons = Quill.import("ui/icons");
  Icons["undo"] = `<svg viewBox="0 0 18 18"><polygon class="ql-fill ql-stroke" points="6 10 4 12 2 10 6 10"/><path class="ql-stroke" d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"/></svg>`;
  Icons["redo"] = `<svg viewBox="0 0 18 18"><polygon class="ql-fill ql-stroke" points="12 10 14 12 16 10 12 10"/><path class="ql-stroke" d="M9.91,13.91A4.6,4.6,0,0,1,9,14,5,5,0,1,1,14,9"/></svg>`;

  // ── Resizable image blot
  const BaseImage = Quill.import("formats/image");
  class ResizableImageBlot extends BaseImage {
    static formats(domNode: HTMLElement) {
      const base = (super.formats as Function)(domNode) as Record<string, any>;
      const w = domNode.style.width || domNode.getAttribute("width");
      if (w) base.width = w;
      return base;
    }
    format(name: string, value: string | false) {
      if (name === "width") {
        if (value) {
          (this as any).domNode.style.width = value;
          (this as any).domNode.setAttribute("width", String(value));
        } else {
          (this as any).domNode.style.removeProperty("width");
          (this as any).domNode.removeAttribute("width");
        }
      } else {
        (super.format as Function)(name, value);
      }
    }
  }
  ResizableImageBlot.blotName = "image";
  ResizableImageBlot.tagName = "IMG";
  Quill.register(ResizableImageBlot, true);
}

const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import("react-quill");
    // RQ is a class component; wrap in forwardRef so dynamic()'s LoadableComponent passes the ref through
    const Forwarded = forwardRef<any, any>((props, ref) => <RQ {...props} ref={ref} />);
    Forwarded.displayName = "ReactQuill";
    return Forwarded;
  },
  { ssr: false }
);


const RESIZE_OPTIONS = [
  { label: "Auto", value: "" },
  { label: "25%",  value: "25%" },
  { label: "50%",  value: "50%" },
  { label: "75%",  value: "75%" },
  { label: "100%", value: "100%" },
];

const ALIGN_OPTIONS = [
  { label: "←", title: "Left",   align: "left" },
  { label: "↔", title: "Center", align: "center" },
  { label: "→", title: "Right",  align: "right" },
];

// Font/size lists must exactly match the whitelists registered above
const FONT_LIST = [
  "Arial", "Georgia", "Impact", "Tahoma", "Times New Roman", "Verdana",
  "Courier New", "Trebuchet MS", "Comic Sans MS", "Lucida Sans", "Palatino",
  "Garamond", "Bookman", "Arial Black", "Century Gothic", "Candara",
  "Franklin Gothic Medium", "Geneva", "Gill Sans",
];
const SIZE_LIST = [
  "8px","10px","12px","14px","16px","18px",
  "20px","24px","28px","32px","36px","40px","48px",
];

const modules = {
  toolbar: {
    container: [
      ["undo", "redo"],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ font: FONT_LIST }],
      [{ size: SIZE_LIST }],
      ["bold", "italic", "underline", "strike"],
      [{ script: "sub" }, { script: "super" }],
      ["code"],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      [{ direction: "rtl" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["blockquote", "code-block"],
      ["link", "image", "video"],
      ["clean"],
    ],
    handlers: {
      undo(this: any) { this.quill.history.undo(); },
      redo(this: any) { this.quill.history.redo(); },
    },
  },
  history: { delay: 500, maxStack: 100, userOnly: true },
  clipboard: {
    matchVisual: false,
    matchers: [
      // Preserve inline styles (color, background, font, size) from pasted HTML
      [1 /* Node.ELEMENT_NODE */, (node: any, delta: any) => {
        const el = node as HTMLElement;
        if (!el?.style) return delta;
        const pick: Record<string, string> = {};
        if (el.style.color)           pick.color      = el.style.color;
        if (el.style.backgroundColor) pick.background = el.style.backgroundColor;
        if (el.style.fontFamily)      pick.font       = el.style.fontFamily.replace(/['"]/g, "").split(",")[0].trim();
        if (el.style.fontSize)        pick.size       = el.style.fontSize;
        if (!Object.keys(pick).length) return delta;
        return {
          ops: delta.ops.map((op: any) =>
            typeof op.insert === "string"
              ? { ...op, attributes: { ...pick, ...(op.attributes ?? {}) } }
              : op
          ),
        };
      }],
    ],
  },
};

const formats = [
  "header", "font", "size",
  "bold", "italic", "underline", "strike",
  "script", "code",
  "color", "background",
  "align", "direction", "indent",
  "list", "bullet",
  "blockquote", "code-block",
  "link", "image", "video",
  "width",
];

export interface RichTextEditorRef {
  getHTML: () => string;
  getText: () => string;
  getDelta: () => object;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string, delta: object, source: string, editor: any) => void;
  placeholder?: string;
  postId?: string;
  minHeight?: number;
}

interface SelectedImg {
  el: HTMLImageElement;
  top: number;
  left: number;
  width: string;
  align: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something amazing…",
  postId = "temp",
  minHeight = 300,
}: RichTextEditorProps) {
  const { accessToken } = useStore();
  const quillRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [selectedImg, setSelectedImg] = useState<SelectedImg | null>(null);

  // ── Inject CSS so font/size picker items show their actual names ──────────
  useEffect(() => {
    const id = "quill-picker-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    const fontRules = FONT_LIST.flatMap((font) => [
      // dropdown item label text + preview
      `.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="${font}"]::before { content: "${font}" !important; font-family: '${font}', sans-serif !important; }`,
      // currently-selected label shown on toolbar button
      `.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="${font}"]::before { content: "${font}" !important; font-family: '${font}', sans-serif !important; }`,
    ]);
    const sizeRules = SIZE_LIST.flatMap((size) => [
      `.ql-snow .ql-picker.ql-size .ql-picker-item[data-value="${size}"]::before { content: "${size}" !important; font-size: ${size} !important; }`,
      `.ql-snow .ql-picker.ql-size .ql-picker-label[data-value="${size}"]::before { content: "${size}" !important; }`,
    ]);
    const scrollRules = [
      `.ql-snow .ql-picker.ql-font .ql-picker-options { max-height: 220px; overflow-y: auto; }`,
      `.ql-snow .ql-picker.ql-size .ql-picker-options { max-height: 220px; overflow-y: auto; }`,
    ];
    style.textContent = [...fontRules, ...sizeRules, ...scrollRules].join("\n");
    document.head.appendChild(style);
  }, []);

  // ── Paste: preserve source formatting by inserting raw clipboard HTML ────
  useEffect(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const handlePaste = (e: ClipboardEvent) => {
      const html = e.clipboardData?.getData("text/html");
      if (!html) return; // plain text → let Quill handle normally
      e.preventDefault();
      e.stopPropagation();
      const range = quill.getSelection(true);
      const index = range?.index ?? quill.getLength();
      if (range?.length) quill.deleteText(range.index, range.length, "user");
      quill.clipboard.dangerouslyPasteHTML(index, html, "user");
    };

    quill.root.addEventListener("paste", handlePaste);
    return () => quill.root.removeEventListener("paste", handlePaste);
  });

  // ── Image upload helpers ──────────────────────────────────────────────────
  useEffect(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const tb = quill.getModule("toolbar");
    tb.addHandler("image", () => {
      const input = document.createElement("input");
      input.setAttribute("type", "file");
      input.setAttribute("accept", "image/*");
      input.click();
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const id = toast.loading("Uploading image…");
        try {
          const url = await uploadImage(file, accessToken, postId);
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", url, "user");
          toast.success("Image uploaded!", { id });
        } catch {
          toast.error("Image upload failed", { id });
        }
      };
    });

    quill.root.addEventListener("paste", async (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const id = toast.loading("Uploading pasted image…");
          try {
            const url = await uploadImage(file, accessToken, postId);
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", url, "user");
            toast.success("Image uploaded!", { id });
          } catch {
            toast.error("Image upload failed", { id });
          }
        }
      }
    });

    quill.root.addEventListener("drop", async (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault(); e.stopPropagation();
      for (const file of files) {
        const id = toast.loading("Uploading image…");
        try {
          const url = await uploadImage(file, accessToken, postId);
          const range = quill.getSelection(true) ?? { index: quill.getLength() };
          quill.insertEmbed(range.index, "image", url, "user");
          toast.success("Image uploaded!", { id });
        } catch {
          toast.error("Image upload failed", { id });
        }
      }
    });
  }, [accessToken, postId]);

  // ── Resize apply — pure DOM + push updated HTML through onChange ──────────
  const applyResize = (size: string) => {
    if (!selectedImg) return;

    // Set width directly on the DOM element
    if (size) {
      selectedImg.el.style.width = size;
      selectedImg.el.style.maxWidth = "100%";
    } else {
      selectedImg.el.style.removeProperty("width");
      selectedImg.el.style.removeProperty("max-width");
    }

    // Push updated innerHTML through onChange so the parent (compose page)
    // gets the new HTML with the inline style included
    const quill = quillRef.current?.getEditor?.();
    if (quill) {
      const html = quill.root.innerHTML;
      onChange(html, {}, "user", quill as any);
    }

    setSelectedImg(prev => prev ? { ...prev, width: size } : null);
  };

  // ── Align apply ───────────────────────────────────────────────────────────
  const applyAlign = (align: string) => {
    if (!selectedImg) return;
    const el = selectedImg.el;

    // Reset all alignment styles first
    el.style.removeProperty("display");
    el.style.removeProperty("margin-left");
    el.style.removeProperty("margin-right");
    el.style.removeProperty("float");

    if (align === "center") {
      el.style.display = "block";
      el.style.marginLeft = "auto";
      el.style.marginRight = "auto";
    } else if (align === "right") {
      el.style.display = "block";
      el.style.marginLeft = "auto";
      el.style.marginRight = "0";
    }
    // left = default (no extra styles needed)

    const quill = quillRef.current?.getEditor?.();
    if (quill) onChange(quill.root.innerHTML, {}, "user", quill as any);
    setSelectedImg(prev => prev ? { ...prev, align } : null);
  };

  // ── Click handler on wrapper div (always mounted, no quill dependency) ────
  const handleWrapperClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Clicked inside the resize toolbar — don't close it
    if (toolbarRef.current?.contains(target)) return;

    if (target.tagName === "IMG" && wrapperRef.current?.contains(target)) {
      const img = target as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      const wrapRect = wrapperRef.current!.getBoundingClientRect();
      const TOOLBAR_W = 440;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Use fixed viewport coordinates so overflow:hidden on the wrapper never clips the toolbar
      const top = spaceBelow > 56 ? rect.bottom + 6 : rect.top - 46;
      const left = Math.max(4, Math.min(rect.left, window.innerWidth - TOOLBAR_W - 4));

      // Highlight selected image
      document.querySelectorAll(".ql-editor img").forEach(i => {
        (i as HTMLElement).style.removeProperty("outline");
      });
      img.style.outline = "2px solid #6366f1";

      const currentAlign =
        img.style.marginLeft === "auto" && img.style.marginRight === "auto" ? "center"
        : img.style.marginLeft === "auto" ? "right"
        : "left";
      setSelectedImg({ el: img, top, left, width: img.style.width || "", align: currentAlign });
    } else {
      // Clicked elsewhere — deselect
      if (selectedImg) {
        selectedImg.el.style.removeProperty("outline");
        setSelectedImg(null);
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={{ "--quill-min-height": `${minHeight}px` } as React.CSSProperties}
      onClick={handleWrapperClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const quill = quillRef.current?.getEditor?.();
        if (!quill) return;
        for (const file of Array.from(e.dataTransfer.files)) {
          if (!file.type.startsWith("image/")) continue;
          const id = toast.loading("Uploading dropped image…");
          try {
            const url = await uploadImage(file, accessToken, postId);
            const range = quill.getSelection(true) ?? { index: 0 };
            quill.insertEmbed(range.index, "image", url, "user");
            toast.success("Image uploaded!", { id });
          } catch {
            toast.error("Image upload failed", { id });
          }
        }
      }}
    >
      <ReactQuill
        ref={quillRef}
        value={value}
        onChange={onChange as any}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        theme="snow"
      />

      {/* Floating resize toolbar — shown when an image is selected */}
      {selectedImg && (
        <div
          ref={toolbarRef}
          className="fixed z-[9999] flex items-center gap-0.5 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-1 select-none"
          style={{ top: selectedImg.top, left: selectedImg.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-[10px] font-semibold text-gray-400 dark:text-dark-tertiary px-1.5 uppercase tracking-wide">
            Size
          </span>
          {RESIZE_OPTIONS.map(({ label, value: size }) => {
            const active = selectedImg.width === size;
            return (
              <button
                key={label}
                type="button"
                onClick={(e) => { e.stopPropagation(); applyResize(size); }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-indigo-500 text-white"
                    : "text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border"
                }`}
              >
                {label}
              </button>
            );
          })}

          <span className="w-px h-5 bg-gray-200 dark:bg-dark-border mx-0.5" />

          <span className="text-[10px] font-semibold text-gray-400 dark:text-dark-tertiary px-1.5 uppercase tracking-wide">
            Align
          </span>
          {ALIGN_OPTIONS.map(({ label, title, align }) => {
            const active = selectedImg.align === align;
            return (
              <button
                key={align}
                type="button"
                title={title}
                onClick={(e) => { e.stopPropagation(); applyAlign(align); }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-indigo-500 text-white"
                    : "text-gray-600 dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-dark-border"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
