// Generated from json/featured-in.json by scripts/json-to-zod.ts. Review it before you run the sync.
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

export const featuredInSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(60).default("Our Mission · Featured In"),
    "heading": z.string().min(1).max(80).default("Podcasts & press").meta({"description":"The page's only H1."}),
    "intro": z.string().max(240).meta({"x-ui":{"widget":"textarea","rows":2}}),
  }).meta({"title":"Hero","description":"The outlet names under the intro are taken from the appearances zone.","x-cms":{"zone":"hero","order":1}}),
  "featuredEpisode": z.strictObject({
    "hidden": z.boolean().default(false),
    "appearance": referenceDef.meta({"description":"A Media Appearance entry. Its title, outlet and platform links are shown here."}),
    "eyebrow": z.string().min(1).max(60).default("Featured episode").meta({"description":"The outlet name is added after it automatically."}),
    "summary": z.string().max(300).optional().meta({"description":"Overrides the appearance's own summary when filled.","x-ui":{"widget":"textarea","rows":3}}),
    "image": imageDef.meta({"description":"Video still or episode art (16:9). Links to the video; never autoplays."}),
    "listenLabel": z.string().min(1).max(40).default("Listen or watch"),
  }).meta({"title":"Featured episode","x-cms":{"zone":"featuredEpisode","order":1}}),
  "appearances": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("All appearances"),
    "heading": z.string().min(1).max(80).default("Episodes & interviews"),
    "items": z.array(referenceDef).min(1).max(40).meta({"description":"Listed in this order. Each shows type, outlet, title, summary and its platform links.","x-ui":{"widget":"referenceList","collection":"mediaAppearances","sortable":true}}),
  }).meta({"title":"All appearances","x-cms":{"zone":"appearances","order":1}}),
  "pressCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80).default("Press & speaking"),
    "body": z.string().max(200).default("For interviews, panels and podcasts, email"),
    "email": z.email(),
    "cta": linkDef.default({"label":"Meet our founder","target":{"internal":{"collection":"clinicians","id":"jess-rebelo"}}}),
  }).meta({"title":"Press & speaking","x-cms":{"zone":"pressCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Featured In","description":"Content for the Featured In (podcasts & press) page. Episode titles, outlets and platform links come from Media Appearance entries. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/featured-in","template":"FeaturedInPage","zones":["hero","featuredEpisode","appearances","pressCta","meta"]}});

export type FeaturedInData = z.infer<typeof featuredInSchema>;

export default featuredInSchema;
