// Generated from json/reviews.json by scripts/json-to-zod.ts. Review it before you run the sync.
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

const reviewDef = z.strictObject({
  "displayName": z.string().min(2).max(40).meta({"description":"First name and last initial only, e.g. Kevin D. Never a full last name."}),
  "text": z.string().min(20).max(4000).meta({"description":"The client's words, verbatim. Fix nothing except stray whitespace.","x-ui":{"widget":"textarea","rows":6}}),
  "consentOnFile": z.literal(true).meta({"description":"Must be true: written permission to publish this review is on file."}),
  "receivedDate": z.iso.date().nullable().default(null).meta({"description":"When the review was received. Internal; not shown."}),
  "hidden": z.boolean().default(false).meta({"description":"Hide this one review without deleting it."}),
});

export const reviewsSchema = z.strictObject({
  "hero": z.strictObject({
    "eyebrow": z.string().min(1).max(60).default("Experience"),
    "heading": z.string().min(1).max(80).default("Client reviews").meta({"description":"The page's only H1."}),
    "intro": z.string().min(1).max(1000).meta({"description":"Leave a blank line between paragraphs.","x-ui":{"widget":"textarea","rows":2}}),
  }).meta({"title":"Hero","x-cms":{"zone":"hero","order":1}}),
  "featureImage": z.strictObject({
    "hidden": z.boolean().default(false),
    "image": imageDef.meta({"description":"Wide photo (21:9). Calm interior, natural light."}),
  }).meta({"title":"Feature image","description":"A hairline divider follows this zone, as on Our Approach.","x-cms":{"zone":"featureImage","order":1}}),
  "reviewList": z.strictObject({
    "hidden": z.boolean().default(false),
    "eyebrow": z.string().min(1).max(40).default("Reviews"),
    "heading": z.string().min(1).max(80).default("What clients say"),
    "summary": z.string().max(160).default("{count} reviews from clients of our founder, Jess Rebelo, LCSW.").meta({"description":"Shown beside the list. {count} is the number of visible reviews."}),
    "asideLink": linkDef.default({"label":"Meet Jess","target":{"internal":{"collection":"clinicians","id":"jessica-rebelo"}}}).meta({"description":"Button under the summary."}),
    "collapseAfterChars": z.int().min(200).max(1200).default(360).meta({"description":"Longer reviews show five lines and a Read full review button."}),
    "expandLabel": z.string().min(1).max(40).default("Read full review"),
    "collapseLabel": z.string().min(1).max(40).default("Show less"),
    "items": z.array(reviewDef).min(1).max(200).meta({"description":"Shown in this order."}),
  }).meta({"title":"Reviews","x-cms":{"zone":"reviewList","order":1}}),
  "shareButton": z.strictObject({
    "hidden": z.boolean().default(false),
    "link": linkDef.default({"label":"Share your experience","target":{"internal":{"collection":"pages","id":"share-experience"}}}).meta({"description":"Floating button, upper right, stays visible while scrolling. Same style as Book with {firstName} on profiles."}),
  }).optional().meta({"title":"Share your experience button","x-cms":{"zone":"shareButton","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(80),
    "body": z.string().max(140).optional(),
    "cta": linkDef.default({"label":"Book a Consultation","target":{"internal":{"collection":"clinicians","id":"jessica-rebelo"}}}).meta({"description":"Must point to a clinician profile or the clinicians list. Booking only starts on a profile."}),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Client Reviews","description":"Content for the Client Reviews page. Layout is fixed by the template; each top-level property is one zone. Reviews live in reviewList.items, in display order. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/reviews","template":"ReviewsPage","zones":["hero","featureImage","reviewList","shareButton","closingCta","meta"]}});

export type ReviewsData = z.infer<typeof reviewsSchema>;

export default reviewsSchema;
