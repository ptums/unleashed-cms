// Generated from json/our-approach.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

const imageDef = z.strictObject({
  "assetId": z.string(),
  "alt": z.string().min(5).max(160).meta({"description":"Required for WCAG."}),
  "focalPoint": z.strictObject({
    "x": z.number().min(0).max(1),
    "y": z.number().min(0).max(1),
  }).optional(),
}).meta({"x-ui":{"widget":"image"}});

const titledTextDef = z.strictObject({
  "title": z.string().min(1).max(40),
  "body": z.string().min(1).max(160).meta({"x-ui":{"widget":"textarea","rows":2}}),
});

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

export const ourApproachSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().max(40).default("Our Mission").meta({"description":"Small caps line above the heading."}),
    "heading": z.string().min(1).max(80).default("Our approach").meta({"description":"The page's only H1."}),
    "intro": z.string().max(2000).meta({"description":"The mission. Leave a blank line between paragraphs.","x-ui":{"widget":"textarea","rows":10}}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "featureImage": z.strictObject({
    "hidden": z.boolean().default(false),
    "image": imageDef.meta({"description":"Wide photo (21:9). Calm interior, natural light, no posed smiles."}),
  }).meta({"title":"Feature image","x-cms":{"zone":"featureImage","order":1}}),
  "values": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().max(40).default("Values"),
    "heading": z.string().min(1).max(80).default("What guides our work"),
    "items": z.array(titledTextDef).min(2).max(6).meta({"description":"Shown in a grid. Four reads best on desktop."}),
  }).meta({"title":"Values","x-cms":{"zone":"values","order":1}}),
  "standardOfCare": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().max(40).default("Standard of care"),
    "heading": z.string().min(1).max(80).default("What every client can count on"),
    "items": z.array(titledTextDef).min(2).max(8).meta({"description":"Each item renders as a bold lead-in followed by one sentence."}),
  }).meta({"title":"Standard of care","x-cms":{"zone":"standardOfCare","order":1}}),
  "founderNote": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().max(40).default("A note from our founder"),
    "portrait": imageDef.meta({"description":"Portrait (4:5)."}),
    "quote": z.string().min(1).max(300).meta({"description":"Short note in the founder's voice. Quotation marks are added by the template.","x-ui":{"widget":"textarea","rows":4}}),
    "founder": referenceDef.meta({"description":"The founder's clinician entry."}),
    "authorName": z.string().max(60).meta({"description":"Name with credentials, as shown under the quote."}),
    "authorRole": z.string().max(40).default("Founder"),
    "profileLink": linkDef.meta({"description":"Should point to the founder's clinician profile."}),
  }).meta({"title":"Founder note","x-cms":{"zone":"founderNote","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80).default("Ready to talk with a clinician?"),
    "cta": linkDef.default({"label":"Book a Consultation","target":{"internal":{"collection":"pages","id":"clinicians"}}}).meta({"description":"Must point to a clinician profile or the clinicians list. Booking only starts on a profile."}),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Our Approach","description":"Content for the Our Approach page. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/our-approach","template":"OurApproachPage","zones":["hero","featureImage","values","standardOfCare","founderNote","closingCta","meta"]}});

export type OurApproachData = z.infer<typeof ourApproachSchema>;

export default ourApproachSchema;
