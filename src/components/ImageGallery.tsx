"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageGalleryLightbox({
  images,
  initialIndex = 0,
  onClose,
}: ImageGalleryProps) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors z-10"
      >
        <X size={22} />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors z-10"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors z-10"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-4xl max-h-[85vh] w-full mx-8"
        >
          <img
            src={images[current]}
            alt={`Image ${current + 1}`}
            className="max-h-[85vh] w-full object-contain rounded-lg"
          />
        </motion.div>
      </AnimatePresence>

      {images.length > 1 && (
        <div className="absolute bottom-4 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface PostImagesProps {
  images: string[];
  maxDisplay?: number;
}

export function PostImages({ images, maxDisplay = 3 }: PostImagesProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (images.length === 0) return null;

  const displayed = images.slice(0, maxDisplay);
  const remainder = images.length - maxDisplay;

  return (
    <>
      <div
        className={`grid gap-1 mt-3 rounded-xl overflow-hidden ${
          displayed.length === 1
            ? "grid-cols-1"
            : displayed.length === 2
            ? "grid-cols-2"
            : "grid-cols-3"
        }`}
      >
        {displayed.map((src, i) => (
          <div
            key={i}
            className="relative cursor-pointer overflow-hidden bg-gray-100"
            style={{ paddingBottom: displayed.length === 1 ? "56.25%" : "100%" }}
            onClick={() => setLightbox(i)}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="post-image absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              onLoad={(e) => (e.currentTarget as HTMLImageElement).classList.add("loaded")}
            />
            {i === maxDisplay - 1 && remainder > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold text-xl">
                +{remainder}
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {lightbox !== null && (
          <ImageGalleryLightbox
            images={images}
            initialIndex={lightbox}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
