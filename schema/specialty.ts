// Generated from json/specialty.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

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

const faqItemDef = z.strictObject({
  "question": z.string().min(1).max(120),
  "answer": z.string().min(1).max(600).meta({"contentMediaType":"text/markdown","x-ui":{"widget":"markdown","toolbar":["bold","italic","link","bulletList"]}}),
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

export const specialtySchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(60).default("Specialties · How we help"),
    "heading": z.string().min(1).max(60).meta({"description":"The page's only H1."}),
    "intro": z.string().min(1).max(2000).meta({"description":"What it is. Leave a blank line between paragraphs.","x-ui":{"widget":"textarea","rows":10}}),
    "evidenceNote": z.string().max(160).optional().meta({"description":"Optional line on the research behind it."}),
    "tileSummary": z.string().min(1).max(110).meta({"description":"One line used on the Home specialties tile. Not shown on this page."}),
    "ctaLabel": z.string().min(1).max(40).default("See clinicians").meta({"description":"Scrolls to the clinicians zone."}),
    "image": imageDef.meta({"description":"Landscape photo (5:4)."}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "whoItHelps": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Who it helps"),
    "heading": z.string().min(1).max(80),
    "items": z.array(z.string().min(1).max(120)).min(2).max(8),
  }).meta({"title":"Who it helps","x-cms":{"zone":"whoItHelps","order":1}}),
  "process": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("The process"),
    "heading": z.string().min(1).max(80),
    "steps": z.array(z.strictObject({
      "title": z.string().min(1).max(40),
      "body": z.string().min(1).max(600).meta({"x-ui":{"widget":"textarea","rows":5}}),
    })).min(2).max(6).meta({"description":"Numbered automatically."}),
  }).meta({"title":"Process","x-cms":{"zone":"process","order":1}}),
  "clinicians": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Clinicians"),
    "heading": z.string().min(1).max(80),
    "mode": z.enum(["auto","manual"]).default("auto").meta({"description":"auto lists every published clinician who has this specialty on their profile."}),
    "clinicians": z.array(referenceDef).min(0).max(12).optional().meta({"description":"Used only when mode is manual.","x-ui":{"widget":"referenceList","collection":"clinicians","sortable":true}}),
    "cardCtaLabel": z.string().min(1).max(40).default("View profile & times").meta({"description":"Card button always opens the clinician's profile."}),
  }).meta({"title":"Clinicians who offer this","x-cms":{"zone":"clinicians","order":1}}),
  "faq": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Questions"),
    "heading": z.string().min(1).max(80),
    "items": z.array(faqItemDef).min(1).max(8),
  }).meta({"title":"FAQ","x-cms":{"zone":"faq","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80),
    "cta": linkDef.default({"label":"Book a Consultation","target":{"internal":{"collection":"pages","id":"clinicians"}}}).meta({"description":"Must go to the clinicians list or a profile, never straight to booking."}),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Specialty","description":"One entry per specialty or method (e.g. EMDR). Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"collection","route":"/specialties/{slug}","template":"SpecialtyPage","zones":["hero","whoItHelps","process","clinicians","faq","closingCta","meta"]}});

export type SpecialtyData = z.infer<typeof specialtySchema>;

export default specialtySchema;
