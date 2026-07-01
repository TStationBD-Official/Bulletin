"use client";

import Link from "next/link";
import { TrendingUp, Heart, MessageCircle, Share2 } from "lucide-react";
import { Post } from "@/types";
import { BentoTile } from "@/components/BentoGrid";

interface TrendingBoxProps {
  title: string;
  posts: Post[];
}

export default function TrendingBox({ title, posts }: TrendingBoxProps) {
  if (posts.length === 0) return null;

  return (
    <BentoTile className="p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 flex items-center justify-center">
          <TrendingUp size={13} className="text-orange-500" />
        </div>
        <h3 className="text-xs font-bold text-gray-900 dark:text-dark-primary uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <div className="space-y-5">
        {posts.map((post, i) => (
          <Link key={post.id} href={`/post/${post.id}`} className="group flex gap-3.5 items-start">
            <span
              className="text-xl font-black flex-shrink-0 w-5 text-center leading-tight mt-0.5 tabular-nums"
              style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#cbd5e1" }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-semibold text-gray-900 dark:text-dark-primary line-clamp-1 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {post.title || "Untitled"}
              </h4>
              <p className="text-[12px] text-gray-500 dark:text-dark-tertiary mt-1 line-clamp-2 leading-snug">
                {post.content?.replace(/<[^>]*>/g, "")}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 dark:text-dark-tertiary">
                <span className="flex items-center gap-1"><Heart size={11} /> {post.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle size={11} /> {post.comments}</span>
                <span className="flex items-center gap-1"><Share2 size={11} /> {post.shares}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </BentoTile>
  );
}
