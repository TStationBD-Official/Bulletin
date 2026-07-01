"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Post, AdminLog } from "@/types";
import { toDate } from "@/lib/utils";
import { format, subDays } from "date-fns";

export function PostsPerDayChart({ posts }: { posts: Post[] }) {
  const data = useMemo(() => {
    const last30 = Array.from({ length: 30 }, (_, i) =>
      subDays(new Date(), 29 - i)
    );
    const dateMap = new Map<string, number>();

    last30.forEach((date) => {
      dateMap.set(format(date, "MMM dd"), 0);
    });

    posts.forEach((post) => {
      const date = format(toDate(post.createdAt), "MMM dd");
      dateMap.set(date, (dateMap.get(date) ?? 0) + 1);
    });

    return Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      posts: count,
    }));
  }, [posts]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
        <YAxis tick={{ fontSize: 12 }} stroke="#999" />
        <Tooltip
          cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="posts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EngagementTrendChart({ posts }: { posts: Post[] }) {
  const data = useMemo(() => {
    const last30 = Array.from({ length: 30 }, (_, i) =>
      subDays(new Date(), 29 - i)
    );
    const dateMap = new Map<string, number>();

    last30.forEach((date) => {
      dateMap.set(format(date, "MMM dd"), 0);
    });

    posts.forEach((post) => {
      const date = format(toDate(post.createdAt), "MMM dd");
      const current = dateMap.get(date) ?? 0;
      dateMap.set(date, current + post.likes + post.comments + post.shares);
    });

    return Array.from(dateMap.entries()).map(([date, engagement]) => ({
      date,
      engagement,
    }));
  }, [posts]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
        <YAxis tick={{ fontSize: 12 }} stroke="#999" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="engagement"
          stroke="#f97316"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AdminActivityChart({ logs }: { logs: AdminLog[] }) {
  const data = useMemo(() => {
    const actionMap = new Map<string, number>();

    logs.forEach((log) => {
      const count = actionMap.get(log.action) ?? 0;
      actionMap.set(log.action, count + 1);
    });

    return Array.from(actionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([action, count]) => ({
        action: action.replace(/_/g, " "),
        count,
      }));
  }, [logs]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#999" />
        <YAxis dataKey="action" type="category" tick={{ fontSize: 12 }} stroke="#999" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="count" fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  );
}
