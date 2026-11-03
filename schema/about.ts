import { z } from "zod";

/**
 * The About page: who the practice is and how it works.
 */
export const aboutPageSchema = z
  .object({
    heroTitle: z
      .string()
      .min(1, "Hero title is required")
      .max(100, "Hero title must be under 100 characters")
      .meta({ "x-cms": { zone: "hero", order: 1 } }),
    intro: z
      .string()
      .min(1, "Intro is required")
      .meta({ "x-cms": { zone: "body", order: 1 } }),
    approach: z
      .string()
      .optional()
      .meta({ "x-cms": { zone: "body", order: 2 } }),
    photoUrl: z
      .url("Must be a valid image URL")
      .optional()
      .meta({ "x-cms": { zone: "aside", order: 1 } }),
  })
  .meta({ title: "About", "x-cms": { kind: "singleton" } });

export type AboutPageData = z.infer<typeof aboutPageSchema>;

export default aboutPageSchema;
