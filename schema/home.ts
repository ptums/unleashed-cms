// Generated from json/home.json by scripts/json-to-zod.ts. Review it before you run the sync.
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

const titledTextDef = z.strictObject({
  "title": z.string().min(1).max(40),
  "body": z.string().min(1).max(200).meta({"x-ui":{"widget":"textarea","rows":2}}),
});

export const homeSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(60).meta({"description":"Small caps line above the heading. Keep it short so it wraps cleanly on mobile."}),
    "heading": z.string().min(1).max(90).meta({"description":"The page's only H1."}),
    "body": z.string().max(420).meta({"description":"Intro paragraph under the heading.","x-ui":{"widget":"textarea","rows":4}}),
    "primaryCta": linkDef.default({"label":"Meet our clinicians","target":{"internal":{"collection":"pages","id":"clinicians"}}}).meta({"description":"Outlined button. Must go to the clinicians list or a profile, never straight to booking."}),
    "secondaryLink": linkDef.default({"label":"What to expect","target":{"internal":{"collection":"pages","id":"what-to-expect"}}}),
    "trustLine": z.array(z.string().min(1).max(40)).min(0).max(4).optional().meta({"description":"Short facts joined with a middle dot, e.g. Free 15-minute consultation."}),
    "image": imageDef.meta({"description":"Portrait-format photo (4:5)."}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "featuredIn": z.strictObject({
    "hidden": z.boolean().default(false),
    "label": z.string().min(1).max(40).default("Featured in"),
    "appearances": z.array(referenceDef).min(1).max(6).meta({"description":"Each shows its outlet name, linked to its main URL.","x-ui":{"widget":"referenceList","collection":"mediaAppearances","sortable":true}}),
    "allLink": linkDef.default({"label":"All podcasts & press","target":{"internal":{"collection":"pages","id":"featured-in"}}}),
  }).meta({"title":"Featured in strip","x-cms":{"zone":"featuredIn","order":1}}),
  "specialties": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Specialties"),
    "heading": z.string().min(1).max(80).default("What we treat"),
    "items": z.array(z.strictObject({
      "title": z.string().min(1).max(60).meta({"description":"Tile heading, for example Trauma & PTSD."}),
      "body": z.string().min(1).max(200).meta({"description":"Sub text under the heading.","x-ui":{"widget":"textarea","rows":3}}),
      "page": referenceDef.optional().meta({"description":"The page the Learn more link opens, for example collection pages and id our-approach, or collection specialties and id emdr."}),
    })).min(1).max(9).meta({"description":"1 tile per item. The Learn more link shows only when the item has a page.","x-ui":{"sortable":true}}),
    "tileLinkLabel": z.string().min(1).max(40).default("Learn More"),
  }).meta({"title":"Specialties grid","x-cms":{"zone":"specialties","order":1}}),
  "clinicians": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Our clinicians"),
    "heading": z.string().min(1).max(80).default("Choose your clinician, then your time."),
    "intro": z.string().max(200).optional().meta({"x-ui":{"widget":"textarea","rows":2}}),
    "mode": z.enum(["auto","manual"]).default("auto").meta({"description":"auto shows every published clinician accepting new clients, in their sort order. manual shows the list below."}),
    "clinicians": z.array(referenceDef).min(0).max(12).optional().meta({"description":"Used only when mode is manual.","x-ui":{"widget":"referenceList","collection":"clinicians","sortable":true}}),
    "limit": z.int().min(1).max(12).default(6),
    "cardCtaLabel": z.string().min(1).max(40).default("View profile & times").meta({"description":"Card button always opens the clinician's profile. Next open date is fetched live."}),
    "recruitingCard": z.strictObject({
      "hidden": z.boolean().default(false),
      "heading": z.string().min(1).max(60).default("Our team is growing."),
      "body": z.string().max(200).meta({"x-ui":{"widget":"textarea","rows":2}}),
      "link": linkDef.default({"label":"Careers","target":{"internal":{"collection":"pages","id":"careers"}}}),
    }).meta({"description":"Card shown beside the clinicians while the team is growing."}),
  }).meta({"title":"Clinicians","x-cms":{"zone":"clinicians","order":1}}),
  "howItWorks": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("How it works"),
    "heading": z.string().min(1).max(80).default("Three steps to begin"),
    "steps": z.array(titledTextDef).min(2).max(5).meta({"description":"Numbered automatically (01, 02, …)."}),
    "moreLink": linkDef.default({"label":"What to expect, in detail","target":{"internal":{"collection":"pages","id":"what-to-expect"}}}),
  }).meta({"title":"How it works","x-cms":{"zone":"howItWorks","order":1}}),
  "approachBand": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Our approach"),
    "statement": z.string().min(1).max(220).meta({"description":"Large italic statement on the dark band. Not a client testimonial.","x-ui":{"widget":"textarea","rows":3}}),
    "cta": linkDef.default({"label":"Read our approach","target":{"internal":{"collection":"pages","id":"our-approach"}}}),
  }).meta({"title":"Approach statement band","x-cms":{"zone":"approachBand","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Home","description":"Content for the Home page. Layout is fixed by the template; each top-level property is one zone. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/","template":"HomePage","zones":["hero","featuredIn","specialties","clinicians","howItWorks","approachBand","meta"]}});

export type HomeData = z.infer<typeof homeSchema>;

export default homeSchema;
