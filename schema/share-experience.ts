// Generated from json/share-experience.json by scripts/json-to-zod.ts. Review it before you run the sync.
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

export const shareExperienceSchema = z.strictObject({
  "form": z.strictObject({
    "eyebrow": z.string().min(1).max(60).default("For current and past clients"),
    "heading": z.string().min(1).max(60).default("Share your experience").meta({"description":"The page's only H1."}),
    "intro": z.string().max(200).default("We read every response and use it to improve our care. It takes about three minutes."),
    "labels": z.strictObject({
      "name": z.string().min(1).max(40).default("Full name"),
      "email": z.string().min(1).max(40).default("Email"),
      "phone": z.string().min(1).max(40).default("Phone"),
      "requiredMark": z.string().min(1).max(20).default("(required)"),
      "ratingLegend": z.string().min(1).max(60).default("Rate our services"),
      "ratingOptions": z.strictObject({
        "excellent": z.string().min(1).max(20).default("Excellent"),
        "good": z.string().min(1).max(20).default("Good"),
        "disappointing": z.string().min(1).max(20).default("Disappointing"),
      }),
      "likedBest": z.string().min(1).max(60).default("What did you like best?"),
      "improve": z.string().min(1).max(60).default("How can we improve?"),
      "recommendLegend": z.string().min(1).max(80).default("Would you recommend us to your friends?"),
      "recommendOptions": z.strictObject({
        "yes": z.string().min(1).max(20).default("Yes"),
        "no": z.string().min(1).max(20).default("No"),
      }),
      "anythingElse": z.string().min(1).max(80).default("Anything else you would like to add?"),
      "publishConsent": z.string().min(1).max(200).default("You may share my review on your website, using my first name and last initial.").meta({"description":"Optional checkbox. When ticked, the submission is flagged as publishable; staff still decide."}),
    }),
    "errors": z.strictObject({
      "summary": z.string().min(1).max(80).default("Please fix {count} to continue."),
      "name": z.string().min(1).max(80).default("Error: enter your full name."),
      "email": z.string().min(1).max(80).default("Error: enter an email address like name@example.com."),
    }).meta({"description":"Shown as text under each field, starting with Error:."}),
    "submitLabel": z.string().min(1).max(40).default("Send review"),
    "cancelLabel": z.string().min(1).max(20).default("Cancel").meta({"description":"Returns to the reviews page."}),
  }).meta({"title":"Review form","x-cms":{"zone":"form","order":1}}),
  "notePanel": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(60).default("Before you write"),
    "items": z.array(z.string().min(1).max(200)).min(1).max(5),
    "crisisText": z.string().min(1).max(200).default("In crisis? Call or text 988, or call 911.").meta({"description":"988 and 911 render as tel: links."}),
  }).meta({"title":"Before you write panel","x-cms":{"zone":"notePanel","order":1}}),
  "thankYou": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(60).default("Thank you for sharing.").meta({"description":"Becomes the H1 after a successful submit."}),
    "body": z.string().min(1).max(200).default("Your review has been sent to our team. We read every response."),
    "primaryLink": linkDef.default({"label":"Back to reviews","target":{"internal":{"collection":"pages","id":"reviews"}}}),
    "secondaryLink": linkDef.default({"label":"Return to home","target":{"internal":{"collection":"pages","id":"home"}}}),
  }).meta({"title":"Thank-you state","description":"Required. Keep hidden false.","x-cms":{"zone":"thankYou","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Share Your Experience","description":"Copy for the private review form for current and past clients. Submissions go to the practice and are never published automatically. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/reviews/share","template":"ShareExperiencePage","zones":["form","notePanel","thankYou","meta"]}});

export type ShareExperienceData = z.infer<typeof shareExperienceSchema>;

export default shareExperienceSchema;
