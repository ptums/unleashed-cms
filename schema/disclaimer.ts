// Generated from json/disclaimer.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

const imageDef = z.strictObject({
  "assetId": z.string(),
  "alt": z.string().min(5).max(160).meta({"description":"Required for WCAG."}),
  "focalPoint": z.strictObject({
    "x": z.number().min(0).max(1),
    "y": z.number().min(0).max(1),
  }).optional(),
}).meta({"x-ui":{"widget":"image"}});

export const disclaimerSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(40).default("Legal"),
    "heading": z.string().min(1).max(80).default("Disclaimer").meta({"description":"The page's only H1."}),
    "lastUpdated": z.iso.date().optional().meta({"description":"Shown under the heading as \"Last updated\"."}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "body": z.strictObject({
    "content": z.string().min(1).max(30000).meta({"description":"Use H2 and H3 only; the heading above is the H1.","contentMediaType":"text/markdown","x-ui":{"widget":"markdown","toolbar":["heading2","heading3","bold","italic","link","bulletList","numberedList"]}}),
  }).meta({"title":"Body","x-cms":{"zone":"body","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Disclaimer","description":"Content for the Disclaimer page: a plain text page with the site's fonts and styling. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/disclaimer","template":"LegalPage","zones":["hero","body","meta"]}});

export type DisclaimerData = z.infer<typeof disclaimerSchema>;

export default disclaimerSchema;
