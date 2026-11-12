// Generated from json/blog.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

const referenceDef = z.strictObject({
  "collection": z.enum(["pages","clinicians","specialties","mediaAppearances","blogPosts"]),
  "id": z.string(),
});

const linkDef = z.strictObject({
  "label": z.string().min(1).max(40),
  "target": z.union([
    z.strictObject({
      "internal": referenceDef,
      "anchor": z.string().optional(),
    }),
    z.strictObject({
      "url": z.url(),
    }),
  ]),
});

const imageDef = z.strictObject({
  "assetId": z.string(),
  "alt": z.string().min(5).max(160).meta({"description":"Required for WCAG."}),
  "focalPoint": z.strictObject({
    "x": z.number().min(0).max(1),
    "y": z.number().min(0).max(1),
  }).optional(),
}).meta({"x-ui":{"widget":"image"}});

export const blogSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(40).default("Blog"),
    "heading": z.string().min(1).max(80).meta({"description":"The page's only H1."}),
    "intro": z.string().max(1000).meta({"x-ui":{"widget":"textarea","rows":6}}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "featuredPost": z.strictObject({
    "hidden": z.boolean().default(false),
    "mode": z.enum(["latest","manual"]).default("latest"),
    "post": referenceDef.optional().meta({"description":"Used only when mode is manual."}),
    "eyebrow": z.string().min(1).max(30).default("Latest").meta({"description":"The post's topic is added after it automatically."}),
    "ctaLabel": z.string().min(1).max(40).default("Read the article"),
  }).meta({"title":"Featured post","x-cms":{"zone":"featuredPost","order":1}}),
  "articleList": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80).default("All articles"),
    "allTopicsLabel": z.string().min(1).max(20).default("All"),
    "topics": z.array(z.string().min(1).max(30)).min(1).max(10).meta({"description":"Filter buttons, in order. Must match the topic names used on posts."}),
    "pageSize": z.int().min(3).max(24).default(9),
    "emptyMessage": z.string().min(1).max(160).default("No articles in this topic yet."),
  }).meta({"title":"All articles","x-cms":{"zone":"articleList","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80),
    "body": z.string().max(1000).optional(),
    "cta": linkDef.default({"label":"Meet our clinicians","target":{"internal":{"collection":"pages","id":"clinicians"}}}),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Blog","description":"Content for the blog landing page. Posts come from the Blog Post collection. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/blog","template":"BlogIndexPage","zones":["hero","featuredPost","articleList","closingCta","meta"]}});

export type BlogData = z.infer<typeof blogSchema>;

export default blogSchema;
