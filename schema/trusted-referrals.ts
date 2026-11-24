// Generated from json/trusted-referrals.json by scripts/json-to-zod.ts. Review it before you run the sync.
import { z } from "zod";

const referralDef = z.strictObject({
  "name": z.string().min(1).max(60).meta({"description":"The person's name, for example Kristin Brien."}),
  "link": z.url().meta({"description":"The full web address, starting with https://."}),
}).meta({"title":"Referral"});

export const trustedReferralsSchema = z.strictObject({
  "referrals": z.strictObject({
    "items": z.array(referralDef).min(0).max(20).meta({"description":"Listed in this order in the Clinicians menu. Each link opens the person's own site in a new tab."}),
  }).meta({"title":"Trusted Referrals","x-cms":{"zone":"referrals","order":1}}),
}).meta({"title":"Trusted Referrals","description":"People outside the practice that Jess trusts and refers clients to. They show under \"Trusted Referrals\" in the Clinicians menu of the site header. This is not a page of its own.","x-cms":{"kind":"singleton","template":"SiteHeader","zones":["referrals"]}});

export type TrustedReferralsData = z.infer<typeof trustedReferralsSchema>;

export default trustedReferralsSchema;
