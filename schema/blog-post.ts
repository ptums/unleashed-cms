// Generated from json/blog-post.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

const referenceDef = z.strictObject({
  "collection": z.enum(["pages","clinicians","specialties","mediaAppearances","blogPosts"]),
  "id": z.string(),
});

const imageDef = z.strictObject({
  "assetId": z.string(),
  "alt": z.string().min(5).max(160).meta({"description":"Required for WCAG."}),
  "focalPoint": z.strictObject({
    "x": z.number().min(0).max(1),
    "y": z.number().min(0).max(1),
  }).optional(),
}).meta({"x-ui":{"widget":"image"}});

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

export const blogPostSchema = z.strictObject({
  "articleHeader": z.strictObject({
    "topic": z.string().min(1).max(30).meta({"description":"Must match a topic on the blog page."}),
    "heading": z.string().min(1).max(100).meta({"description":"The page's only H1."}),
    "dek": z.string().min(1).max(200).meta({"description":"One-sentence summary under the title. Also used on cards.","x-ui":{"widget":"textarea","rows":2}}),
    "author": referenceDef.meta({"description":"The author's clinician entry. Name and credentials come from there."}),
    "publishDate": z.iso.date(),
    "readMinutes": z.int().min(1).max(60),
    "image": imageDef.meta({"description":"Wide photo (21:9). Also used on cards."}),
  }).meta({"title":"Article header","x-cms":{"zone":"articleHeader","order":1}}),
  "body": z.strictObject({
    "hidden": z.boolean().default(false),
    "content": z.string().min(1).max(20000).meta({"description":"Use H2 and H3 only; the title is the H1.","contentMediaType":"text/markdown","x-ui":{"widget":"markdown","toolbar":["heading2","heading3","bold","italic","link","bulletList","numberedList","quote"]}}),
  }).meta({"title":"Article body","description":"Keep hidden false.","x-cms":{"zone":"body","order":1}}),
  "crisisCallout": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(60).default("If you are in crisis"),
    "body": z.string().min(1).max(240).meta({"x-ui":{"widget":"textarea","rows":2}}),
  }).meta({"title":"Crisis callout","description":"Recommended on every post about trauma, grief or mental health.","x-cms":{"zone":"crisisCallout","order":1}}),
  "authorBox": z.strictObject({
    "hidden": z.boolean().default(false),
    "bio": z.string().max(200).optional().meta({"description":"Overrides the clinician's summary when filled.","x-ui":{"widget":"textarea","rows":2}}),
    "linkLabel": z.string().min(1).max(40).default("View profile & open times"),
  }).meta({"title":"Author box","x-cms":{"zone":"authorBox","order":1}}),
  "related": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(60).default("Keep reading"),
    "mode": z.enum(["auto","manual"]).default("auto").meta({"description":"auto picks recent posts on the same topic."}),
    "posts": z.array(referenceDef).min(0).max(3).optional().meta({"description":"Used only when mode is manual.","x-ui":{"widget":"referenceList","collection":"blogPosts","sortable":true}}),
    "allLink": linkDef.default({"label":"All articles","target":{"internal":{"collection":"pages","id":"blog"}}}),
  }).meta({"title":"Keep reading","x-cms":{"zone":"related","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80),
    "body": z.string().max(140).optional(),
    "cta": linkDef.default({"label":"Book a Consultation","target":{"internal":{"collection":"pages","id":"clinicians"}}}).meta({"description":"Must go to the clinicians list or a profile, never straight to booking."}),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Blog Post","description":"One entry per article. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"collection","route":"/blog/{slug}","template":"BlogPostPage","zones":["articleHeader","body","crisisCallout","authorBox","related","closingCta","meta"]}});

export type BlogPostData = z.infer<typeof blogPostSchema>;

export default blogPostSchema;
