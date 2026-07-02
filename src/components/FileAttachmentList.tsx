"use client";

import { FileText, FileSpreadsheet, Presentation, File as FileIcon, X } from "lucide-react";
import { FileAttachment } from "@/types";

function iconFor(mimeType: string) {
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("word")) return FileText;
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return Presentation;
  return FileIcon;
}

function labelFor(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF Document";
  if (mimeType.includes("word")) return "Word Document";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "Excel Spreadsheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "PowerPoint Presentation";
  if (mimeType === "text/plain") return "Text File";
  return "File";
}

function formatSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileAttachmentListProps {
  files: FileAttachment[];
  className?: string;
  /** When provided, each item shows a remove button instead of linking out (compose preview mode) */
  onRemove?: (index: number) => void;
}

export default function FileAttachmentList({ files, className, onRemove }: FileAttachmentListProps) {
  if (!files || files.length === 0) return null;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {files.map((f, i) => {
        const Icon = iconFor(f.mimeType);
        const size = formatSize(f.size);
        const subtitle = size ? `${labelFor(f.mimeType)} · ${size}` : labelFor(f.mimeType);

        const content = (
          <>
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-dark-border flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-dark-tertiary">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-dark-primary truncate">{f.name}</p>
              <p className="text-[12px] text-gray-400 dark:text-dark-tertiary">{subtitle}</p>
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(i); }}
                title="Remove"
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 dark:text-dark-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </>
        );

        const boxClass =
          "flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 dark:border-dark-border bg-gray-50/60 dark:bg-dark-card-2 hover:border-gray-200 dark:hover:border-dark-border/80 hover:shadow-sm transition-all";

        if (onRemove) {
          return (
            <div key={i} className={boxClass}>
              {content}
            </div>
          );
        }

        return (
          <a
            key={i}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={boxClass}
          >
            {content}
          </a>
        );
      })}
    </div>
  );
}
