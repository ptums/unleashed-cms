// Generated from json/booking.json by scripts/json-to-zod.ts. Review it before you run the sync.
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

export const bookingSchema = z.strictObject({
  "stepTime": z.strictObject({
    "progressLabel": z.string().min(1).max(20).default("Time"),
    "heading": z.string().min(1).max(60).default("Choose a time").meta({"description":"The page's only H1."}),
    "intro": z.string().max(160).default("Times are Eastern. The consultation is free and has no obligation."),
    "slotsLegend": z.string().min(1).max(60).default("Open times with {firstName}"),
    "formatLegend": z.string().min(1).max(60).default("How would you like to meet?"),
    "videoLabel": z.string().min(1).max(30).default("Video call"),
    "phoneLabel": z.string().min(1).max(30).default("Phone call"),
    "continueLabel": z.string().min(1).max(40).default("Continue to your details"),
  }).meta({"title":"Step 1: time","x-cms":{"zone":"stepTime","order":1}}),
  "stepDetails": z.strictObject({
    "hidden": z.boolean().default(false),
    "progressLabel": z.string().min(1).max(20).default("Your details"),
    "heading": z.string().min(1).max(60).default("Your details").meta({"description":"Becomes the H1 while this step is shown."}),
    "intro": z.string().max(160).default("Used only to confirm your appointment."),
    "nameLabel": z.string().min(1).max(40).default("Full name"),
    "emailLabel": z.string().min(1).max(40).default("Email"),
    "emailHint": z.string().max(120).default("We send your confirmation and intake forms here."),
    "phoneLabel": z.string().min(1).max(40).default("Phone"),
    "payLegend": z.string().min(1).max(60).default("How do you plan to pay?"),
    "payOptions": z.strictObject({
      "selfPay": z.string().min(1).max(30).default("Self-pay"),
      "insurance": z.string().min(1).max(30).default("Insurance"),
      "unsure": z.string().min(1).max(30).default("Not sure yet"),
    }),
    "consentText": z.string().min(1).max(240).meta({"description":"Checkbox text. Must mention that the practice is not an emergency service and point to 988.","x-ui":{"widget":"textarea","rows":2}}),
    "errors": z.strictObject({
      "summary": z.string().min(1).max(80).default("Please fix {count} to continue."),
      "name": z.string().min(1).max(80).default("Error: enter your full name."),
      "email": z.string().min(1).max(80).default("Error: enter an email address like name@example.com."),
      "phone": z.string().min(1).max(80).default("Error: enter a phone number we can reach you on."),
      "consent": z.string().min(1).max(80).default("Error: please confirm to continue."),
    }).meta({"description":"Shown as text under each field. Each starts with Error: so it is not signaled by color alone."}),
    "submitLabel": z.string().min(1).max(40).default("Confirm booking"),
    "backLabel": z.string().min(1).max(20).default("Back"),
  }).meta({"title":"Step 2: details","description":"Required for booking. Keep hidden false.","x-cms":{"zone":"stepDetails","order":1}}),
  "stepConfirmed": z.strictObject({
    "hidden": z.boolean().default(false),
    "progressLabel": z.string().min(1).max(20).default("Confirmed"),
    "heading": z.string().min(1).max(60).default("You’re booked.").meta({"description":"Becomes the H1 while this step is shown."}),
    "summary": z.string().min(1).max(200).default("Your consultation with {firstName} is on {time}, by {format}.").meta({"description":"Tokens: {firstName}, {time}, {format}."}),
    "calendarHeading": z.string().min(1).max(60).default("Add to your calendar"),
    "calendarLabels": z.strictObject({
      "google": z.string().min(1).max(30).default("Google Calendar"),
      "apple": z.string().min(1).max(30).default("Apple (.ics)"),
      "outlook": z.string().min(1).max(30).default("Outlook"),
    }),
    "nextStepsHeading": z.string().min(1).max(60).default("What happens next"),
    "nextSteps": z.array(z.string().min(1).max(200)).min(1).max(5).meta({"description":"Tokens: {email}, {firstName}, {phone}."}),
    "changePolicy": z.string().min(1).max(240).meta({"x-ui":{"widget":"textarea","rows":2}}),
    "homeLink": linkDef.default({"label":"Return to home","target":{"internal":{"collection":"pages","id":"home"}}}),
  }).meta({"title":"Step 3: confirmation","description":"Required for booking. Keep hidden false.","x-cms":{"zone":"stepConfirmed","order":1}}),
  "summaryPanel": z.strictObject({
    "hidden": z.boolean().default(false),
    "heading": z.string().min(1).max(40).default("Your booking"),
    "rowLabels": z.strictObject({
      "session": z.string().min(1).max(20).default("Session"),
      "time": z.string().min(1).max(20).default("Time"),
      "format": z.string().min(1).max(20).default("Format"),
      "cost": z.string().min(1).max(20).default("Cost"),
    }),
    "changeLabel": z.string().min(1).max(40).default("Change time or format"),
    "exitLabel": z.string().min(1).max(60).default("Back to {firstName}’s profile").meta({"description":"Link in the booking header."}),
  }).meta({"title":"Booking summary panel","description":"Shows the chosen clinician and time on every step. Keep hidden false.","x-cms":{"zone":"summaryPanel","order":1}}),
  "seo": z.strictObject({
    "title": z.string().max(60),
    "description": z.string().max(160),
    "ogImage": imageDef.optional(),
    "noindex": z.boolean().default(false),
  }).meta({"title":"SEO","x-cms":{"zone":"meta","order":1}}),
}).meta({"title":"Booking","description":"Copy for the 3-step booking flow. Times, clinician, session types and fees come from the clinician entry and the scheduling system, not from here. Only one step shows at a time; the visible step's heading is the page's H1. Header, footer and crisis line come from site settings.","x-cms":{"kind":"singleton","route":"/book","template":"BookingFlowPage","zones":["stepTime","stepDetails","stepConfirmed","summaryPanel","meta"]}});

export type BookingData = z.infer<typeof bookingSchema>;

export default bookingSchema;
