import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { library } from "@/lib/repo";
import { LANDERS, landerChapters } from "@/lib/marketing";
import { chapterSlug } from "@/lib/ncert";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().APP_URL;
  const lessons = await library.listPublished({}).catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/for-parents`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/learn`, changeFrequency: "monthly", priority: 0.8 },
    ...LANDERS.map((l) => ({ url: `${base}/learn/${l.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...LANDERS.flatMap((l) => landerChapters(l).map((c) => ({ url: `${base}/learn/${l.slug}/${chapterSlug(c)}`, changeFrequency: "monthly" as const, priority: 0.7 }))),
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/library`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/legal/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/refunds`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/delete-account`, changeFrequency: "yearly", priority: 0.2 },
    ...lessons.map((l) => ({ url: `${base}/library/${l.id}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
