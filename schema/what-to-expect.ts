// Generated from json/what-to-expect.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

const stepDef = z.strictObject({
  "title": z.string().min(1).max(40),
  "body": z.string().min(1).max(320).meta({"x-ui":{"widget":"textarea","rows":3}}),
  "facts": z.array(z.strictObject({
    "label": z.string().min(1).max(20),
    "value": z.string().min(1).max(60),
  })).min(1).max(4).meta({"description":"Short label and value pairs, e.g. Length · 15 minutes."}),
});

const imageDef = z.strictObject({
  "assetId": z.string(),
  "alt": z.string().min(5).max(160).meta({"description":"Required for WCAG."}),
  "focalPoint": z.strictObject({
    "x": z.number().min(0).max(1),
    "y": z.number().min(0).max(1),
  }).optional(),
}).meta({"x-ui":{"widget":"image"}});

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

export const whatToExpectSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(40).default("Experience"),
    "heading": z.string().min(1).max(80).default("What to expect").meta({"description":"The page's only H1."}),
    "intro": z.string().max(240).meta({"x-ui":{"widget":"textarea","rows":2}}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "steps": z.strictObject({
    "hidden": z.boolean().default(false),
    "items": z.array(stepDef).min(2).max(5).meta({"description":"Numbered automatically, with a Step n of N label."}),
  }).meta({"title":"Steps","x-cms":{"zone":"steps","order":1}}),
  "formats": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("In person & online"),
    "heading": z.string().min(1).max(80),
    "body": z.string().min(1).max(1000).meta({"x-ui":{"widget":"textarea","rows":6}}),
    "image": imageDef.meta({"description":"Landscape photo (4:3)."}),
    "link": linkDef.default({"label":"Fees & insurance","target":{"internal":{"collection":"pages","id":"fees-insurance"}}}),
  }).meta({"title":"In person & online","x-cms":{"zone":"formats","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(1000),
    "body": z.string().max(140).optional(),
    "cta": linkDef.default({"label":"Meet our clinicians","target":{"internal":{"collection":"pages","id":"clinicians"}}}),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"What to Expect","description":"Content for the What to Expect page. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/what-to-expect","template":"WhatToExpectPage","zones":["hero","steps","formats","closingCta","meta"]}});

export type WhatToExpectData = z.infer<typeof whatToExpectSchema>;

export default whatToExpectSchema;
