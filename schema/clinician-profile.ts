// Generated from json/clinician-profile.json by scripts/json-to-zod.ts. Review it before you run the sync.
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

const sessionTypeDef = z.strictObject({
  "key": z.string().min(1).max(30).regex(new RegExp("^[a-z0-9_]+$")).meta({"description":"Stable id used by booking, e.g. consultation."}),
  "label": z.string().min(1).max(40),
  "minMinutes": z.int().min(5).max(240),
  "maxMinutes": z.int().min(5).max(240).nullable().default(null).meta({"description":"Set for a range, e.g. 60–75. Leave empty for a fixed length."}),
  "price": z.string().min(1).max(30).meta({"description":"Shown as typed, for example Free or $255."}),
  "bookableOnline": z.boolean().default(false).meta({"description":"Offered in booking step 1."}),
  "modes": z.array(z.enum(["in_person","video","phone"])).min(1).max(3).optional(),
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

export const clinicianProfileSchema = z.strictObject({
  "profileHeader": z.strictObject({
    "displayName": z.string().min(1).max(80).meta({"description":"Name with credentials, e.g. Jess Rebelo, LCSW. The page's only H1."}),
    "firstName": z.string().min(1).max(40).meta({"description":"Used in labels such as Book with {firstName}."}),
    "roleLine": z.string().min(1).max(80).meta({"description":"Small caps line above the name, e.g. Founder · Licensed Clinical Social Worker."}),
    "portrait": imageDef.meta({"description":"Portrait (3:4)."}),
    "summary": z.string().min(1).max(280).meta({"description":"Intro under the name. Also used on clinician cards.","x-ui":{"widget":"textarea","rows":3}}),
    "ages": z.string().max(40).optional().meta({"description":"e.g. Adults 18+"}),
    "sessionsLine": z.string().max(100).optional().meta({"description":"Where and how they see clients, e.g. In person in [City] · Online in [State]."}),
    "languages": z.array(z.string().min(1).max(30)).min(1).max(6),
    "specialties": z.array(referenceDef).min(1).max(8).meta({"description":"Shown as chips. Also lists this clinician on each specialty page.","x-ui":{"widget":"referenceList","collection":"specialties","sortable":true}}),
  }).meta({"title":"Profile header","x-cms":{"zone":"profileHeader","order":1}}),
  "booking": z.strictObject({
    "hidden": z.boolean().default(false),
    "acceptingNewClients": z.boolean().default(true).meta({"description":"When false, the open times are replaced by the waitlist message."}),
    "heading": z.string().min(1).max(60).default("Book with {firstName}").meta({"description":"Supports the {firstName} token."}),
    "subhead": z.string().max(140).default("Free 15-minute consultation. Choose a time to begin."),
    "slotsLabel": z.string().min(1).max(40).default("Next open times · ET"),
    "slotsShown": z.int().min(2).max(12).default(6),
    "ctaLabel": z.string().min(1).max(32).default("Book a Consultation"),
    "allTimesLabel": z.string().min(1).max(40).default("See all open times"),
    "waitlistMessage": z.string().max(200).optional().meta({"x-ui":{"widget":"textarea","rows":2}}),
    "provider": z.enum(["simplepractice","jane","acuity","calendly","custom"]),
    "externalCalendarId": z.string().min(1).max(120).meta({"description":"Internal. Never rendered."}),
    "defaultSessionTypeKey": z.string().min(1).max(30).regex(new RegExp("^[a-z0-9_]+$")).default("consultation").meta({"description":"Must match a key in the fees zone. Usually the free consultation."}),
  }).meta({"title":"Booking card","description":"Booking starts only here. Keep hidden false unless the clinician is not taking clients at all.","x-cms":{"zone":"booking","order":1}}),
  "approach": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(40).default("Approach"),
    "body": z.string().min(1).max(1500).meta({"contentMediaType":"text/markdown","x-ui":{"widget":"markdown","toolbar":["bold","italic","link","bulletList"]}}),
  }).meta({"title":"Approach","x-cms":{"zone":"approach","order":1}}),
  "credentials": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(40).default("Credentials"),
    "education": z.array(z.strictObject({
      "degree": z.string().min(1).max(20),
      "institution": z.string().min(1).max(80),
      "year": z.int().min(1950).max(2100).nullable().default(null),
    })).min(0).max(4).optional(),
    "licenses": z.array(z.strictObject({
      "type": z.string().min(1).max(12).meta({"description":"e.g. LCSW, LMHC, LMFT"}),
      "state": z.string().min(2).max(2).regex(new RegExp("^[A-Z]{2}$")).meta({"description":"Two-letter state code."}),
      "number": z.string().min(1).max(30),
    })).min(1).max(5).meta({"description":"Shown publicly; many state boards require the license number."}),
    "trainings": z.array(z.strictObject({
      "name": z.string().min(1).max(80),
      "provider": z.string().max(80).optional(),
      "year": z.int().min(1950).max(2100).nullable().default(null),
    })).min(0).max(8).optional(),
    "practicingSince": z.int().min(1950).max(2100).nullable().default(null),
  }).meta({"title":"Credentials","x-cms":{"zone":"credentials","order":1}}),
  "fees": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(40).default("Fees & insurance"),
    "caption": z.string().min(1).max(60).default("Self-pay rates, per session"),
    "sessionTypes": z.array(sessionTypeDef).min(1).max(6).meta({"description":"Rows of the fee table, in order."}),
    "insuranceStatus": z.enum(["in_network","out_of_network","both","self_pay_only"]),
    "insuranceNote": z.string().max(300).optional().meta({"x-ui":{"widget":"textarea","rows":3}}),
    "superbills": z.boolean().default(true),
    "slidingScale": z.boolean().default(false),
    "showGoodFaithEstimateNotice": z.boolean().default(true).meta({"description":"No Surprises Act notice for self-pay clients."}),
  }).meta({"title":"Fees & insurance","x-cms":{"zone":"fees","order":1}}),
  "featuredIn": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(40).default("Featured in"),
    "appearances": z.array(referenceDef).min(1).max(10).meta({"x-ui":{"widget":"referenceList","collection":"mediaAppearances","sortable":true}}),
    "allLink": linkDef.default({"label":"All podcasts & press","target":{"internal":{"collection":"pages","id":"featured-in"}}}),
  }).meta({"title":"Featured in","x-cms":{"zone":"featuredIn","order":1}}),
  "closingCta": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().max(80).nullable().default(null).meta({"description":"Leave empty to show the next open time, e.g. Next open: Thu, Oct 29 · 10:00 AM."}),
    "body": z.string().max(140).default("Free 15-minute consultation with {firstName}."),
    "ctaLabel": z.string().min(1).max(32).default("Book a Consultation"),
  }).meta({"title":"Closing call to action","x-cms":{"zone":"closingCta","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Clinician Profile","description":"One entry per clinician. Layout is fixed by the template; each top-level property is one zone. Open appointment times are fetched live from the scheduling system using the booking zone; they are not stored here. Header, footer and crisis line come from site settings.","x-cms":{"kind":"collection","route":"/clinicians/{slug}","template":"ClinicianProfilePage","zones":["profileHeader","booking","approach","credentials","fees","featuredIn","closingCta","meta"]}});

export type ClinicianProfileData = z.infer<typeof clinicianProfileSchema>;

export default clinicianProfileSchema;
