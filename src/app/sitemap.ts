import type { MetadataRoute } from "next";

const BASE_URL = "https://bulletinbd.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/terms", "/privacy", "/guidelines"];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
