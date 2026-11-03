import { z } from "zod";

/**
 * Validates the core content fields required for rendering the Home page.
 */
export const homePageSchema = z
  .object({
    heroTitle: z
      .string()
      .min(1, "Hero title is required")
      .meta({ "x-cms": { zone: "hero", order: 1 } })
      .max(100, "Hero title must be under 100 characters"),
    mainBody: z
      .string()
      .min(1, "Main body content is required")
      .meta({ "x-cms": { zone: "body", order: 1 } }),
    featuredImageUrl: z
      .url("Must be a valid image URL")
      .optional()
      .meta({ "x-cms": { zone: "body", order: 2 } }),
  })
  .meta({ title: "Home", "x-cms": { kind: "singleton" } });
// Extract the TypeScript type from the Zod schema
export type HomePageData = z.infer<typeof homePageSchema>;
