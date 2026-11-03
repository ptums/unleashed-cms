import { z } from "zod";

// Home page, zone based. Converted from home-page-schema.json (a section-list design).
//
// Zone model: the HomePage template fixes the layout, top to bottom:
//   hero -> featuredIn -> specialties -> clinicians -> howItWorks -> approach
// Each zone holds 1 block. The editor fills in fields and can hide a block (R13),
// but cannot move, add or repeat blocks. "meta" holds page data that is not rendered.
//
// Left out on purpose, because the CMS owns them: id, status, updatedAt, publishedAt.
// Left out because zones replace them: sections, type, key (the zone id is the anchor),
// and the unused free-text section.

// ---------- Shared parts ----------

const reference = z.object({
  collection: z.enum(["pages", "clinicians", "specialties", "mediaAppearances", "blogPosts"]),
  id: z.string().min(1),
});

const link = z.object({
  label: z.string().min(1).max(40),
  target: z.union([
    z.object({
      internal: reference,
      anchor: z.string().optional(),
    }),
    z.object({
      url: z.url(),
    }),
  ]),
});

const image = z
  .object({
    assetId: z.string().min(1),
    alt: z.string().min(5).max(160).meta({ description: "Required for WCAG." }),
    focalPoint: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      })
      .optional(),
  })
  .meta({ "x-ui": { widget: "image", aspectRatio: "4:5" } });

const background = z
  .enum(["linen", "lightCream", "darkForest"])
  .default("linen")
  .meta({ description: "Only these three keep text contrast at WCAG AA. Cream is never used for text." });

const hidden = z.boolean().default(false).meta({ description: "Hide this block on the site." });

const referenceList = (collection: string) => ({ "x-ui": { widget: "referenceList", collection, sortable: true } });

// ---------- Zone blocks ----------

const hero = z.object({
  background,
  eyebrow: z.string().max(60).meta({
    description: "Small caps line above the headline. Keep short so it wraps cleanly on mobile.",
  }),
  heading: z.string().min(1).max(90).meta({
    description: "The page's only H1. Required: an empty heading is not allowed.",
  }),
  body: z.string().max(420).meta({ "x-ui": { widget: "textarea", rows: 4 } }),
  primaryCta: link.meta({
    description: "Outlined button. Must point to the clinicians list or a clinician profile, never straight to booking.",
  }),
  secondaryLink: link.optional(),
  trustLine: z
    .array(z.string().max(40))
    .max(4)
    .optional()
    .meta({ description: "Joined with a middle dot, e.g. Free 15-minute consultation · Licensed clinicians." }),
  image,
});

const featuredIn = z.object({
  hidden,
  background,
  label: z.string().default("Featured in"),
  appearances: z
    .array(reference)
    .min(1)
    .max(6)
    .meta({
      description: "Media Appearance documents. Each renders as its outlet name linking to its primary URL.",
      ...referenceList("mediaAppearances"),
    }),
  allLink: link.optional(),
});

const specialties = z.object({
  hidden,
  background,
  eyebrow: z.string().default("Specialties"),
  heading: z.string().default("What we treat"),
  specialties: z
    .array(reference)
    .min(1)
    .max(9)
    .meta({
      description:
        "Tiles use each Specialty's name and short summary. A tile links to the specialty page when one is published.",
      ...referenceList("specialties"),
    }),
  tileLinkLabel: z.string().default("Learn more"),
});

const clinicians = z.object({
  hidden,
  background,
  eyebrow: z.string().default("Our clinicians"),
  heading: z.string().default("Choose your clinician, then your time."),
  intro: z.string().max(200).optional(),
  source: z
    .object({
      mode: z.enum(["auto", "manual"]).default("auto"),
      clinicians: z.array(reference).optional().meta(referenceList("clinicians")),
      limit: z.int().min(1).max(12).default(6),
    })
    .meta({
      description: "auto = all published clinicians accepting new clients, by sortOrder. manual = the picked list.",
    }),
  cardCtaLabel: z.string().default("View profile & times").meta({
    description: "The card button always goes to the clinician's profile. The next open date is fetched live.",
  }),
  recruitingCard: z
    .object({
      enabled: z.boolean().default(true),
      heading: z.string().optional(),
      body: z.string().max(200).optional(),
      link: link.optional(),
    })
    .optional()
    .meta({ description: "Optional card shown beside the clinicians, e.g. Our team is growing." }),
});

const howItWorks = z.object({
  hidden,
  background,
  eyebrow: z.string().default("How it works"),
  heading: z.string().default("Three steps to begin"),
  steps: z
    .array(
      z.object({
        title: z.string().max(40),
        body: z.string().max(160),
      }),
    )
    .min(2)
    .max(5)
    .meta({ description: "Numbered automatically (01, 02, ...)." }),
  moreLink: link.optional(),
});

const approach = z.object({
  hidden,
  background: z.enum(["darkForest", "lightCream"]).default("darkForest"),
  eyebrow: z.string().optional(),
  statement: z.string().max(220).meta({
    description: "Rendered large in Playfair italic. Not a client testimonial.",
  }),
  cta: link.optional(),
});

const seo = z.object({
  title: z.string().max(60),
  description: z.string().max(160),
  ogImage: image.optional(),
  noindex: z.boolean().default(false),
});

// ---------- The page ----------

export const homePageSchema = z
  .object({
    hero: hero.meta({ title: "Hero", "x-cms": { zone: "hero", order: 1 } }),
    featuredIn: featuredIn.meta({ title: "Featured in", "x-cms": { zone: "featuredIn", order: 1 } }),
    specialties: specialties.meta({ title: "Specialties", "x-cms": { zone: "specialties", order: 1 } }),
    clinicians: clinicians.meta({ title: "Clinicians", "x-cms": { zone: "clinicians", order: 1 } }),
    howItWorks: howItWorks.meta({ title: "How it works", "x-cms": { zone: "howItWorks", order: 1 } }),
    approach: approach.meta({ title: "Our approach", "x-cms": { zone: "approach", order: 1 } }),
    seo: seo.meta({ title: "SEO", "x-cms": { zone: "meta", order: 1 } }),
  })
  .meta({
    title: "Home",
    "x-cms": {
      kind: "singleton",
      route: "/",
      template: "HomePage",
      zones: ["hero", "featuredIn", "specialties", "clinicians", "howItWorks", "approach", "meta"],
    },
  });

export type HomePageData = z.infer<typeof homePageSchema>;

export default homePageSchema;
