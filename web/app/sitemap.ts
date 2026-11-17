import type { MetadataRoute } from "next";
import { scopes } from "@/lib/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/$/, "");
  const paths = ["/", "/mobility/", "/planning/", "/compensation/", "/methods/", "/brief/", ...scopes().map((s) => `/d/${s.code}/`)];
  return paths.map((p) => ({ url: `${base}${p}` }));
}
