// Turns a page's JSON Schema into a simpler schema for the editor's form.
//
// The stored schema and the saved data do not change. This only decides what a
// non-technical editor sees:
//   * developer settings are left out of the form (their saved values are kept);
//   * field names get plain-English labels;
//   * coded choices (auto/manual, in_network ...) get readable names;
//   * the "which collection" part of a reference is filled in for the editor;
//   * notes written for developers are removed from the help text.
//
// Publish still validates against the full stored schema, so nothing is skipped.

import type { JsonSchema } from "./api";

type Node = Record<string, unknown>;

// Developer settings. Left out of the form only when the field is optional or has a
// default, so a hidden field can never block publish with an error the editor can't fix.
const DEVELOPER_FIELDS = new Set([
  "focalPoint",
  "anchor",
  "background",
  "noindex",
  "externalCalendarId",
  "defaultSessionTypeKey",
  "provider",
  "currency",
  "readMinutes",
]);

// Fields the AI service writes when a page is published: the SEO data and the image
// descriptions. The editor never sees them. On a later publish the service decides if the
// page changed enough to write them again.
const AI_FIELDS = new Set(["seo", "alt"]);
const AI_ZONES = new Set(["meta"]);

// Plain-English labels. Anything not listed is turned from camelCase into a sentence.
const LABELS: Record<string, string> = {
  hero: "Top of page",
  seo: "Search engines (SEO)",
  eyebrow: "Small label above the heading",
  heading: "Heading",
  subhead: "Subheading",
  dek: "One-line summary",
  body: "Text",
  intro: "Intro text",
  statement: "Statement",
  cta: "Button",
  primaryCta: "Main button",
  secondaryLink: "Second link",
  closingCta: "Closing call to action",
  moreLink: "\"Read more\" link",
  allLink: "\"See all\" link",
  pressCta: "Press button",
  ctaLabel: "Button text",
  cardCtaLabel: "Card button text",
  tileLinkLabel: "Tile link text",
  linkLabel: "Link text",
  label: "Text",
  target: "Goes to",
  internal: "Page on this site",
  url: "Web address",
  collection: "Type",
  id: "Which one",
  image: "Image",
  portrait: "Portrait photo",
  ogImage: "Image for social media shares",
  assetId: "Image file",
  alt: "Image description",
  trustLine: "Trust points",
  items: "Items",
  hidden: "Hide this section",
  title: "Title",
  description: "Description",
  amountCents: "Price in cents (15000 = $150)",
  minMinutes: "Minutes (shortest)",
  maxMinutes: "Minutes (longest)",
  acceptingNewClients: "Accepting new clients",
  bookableOnline: "Can be booked online",
  showGoodFaithEstimateNotice: "Show the Good Faith Estimate notice",
  insuranceStatus: "Insurance",
  slidingScale: "Offers a sliding scale",
  superbills: "Provides superbills",
  mode: "How to choose",
  limit: "How many to show",
  key: "Short code (do not change)",
  roleLine: "Role line",
  sessionsLine: "Where and how sessions happen",
  displayName: "Name with credentials",
  practicingSince: "Practicing since",
  pageSize: "Posts per page",
  emptyMessage: "Message when there are no posts",
};

// Titles from the schema exports that are still jargon.
const TITLE_REPLACEMENTS: Record<string, string> = {
  Hero: "Top of page",
  SEO: "Search engines (SEO)",
  "Closing call to action": "Closing message and button",
};

function plainTitle(title: string): string {
  return TITLE_REPLACEMENTS[title] ?? title;
}

// Readable names for coded choices.
const CHOICE_LABELS: Record<string, string> = {
  auto: "Choose automatically",
  manual: "Let me pick",
  pages: "Page",
  clinicians: "Clinician",
  specialties: "Specialty",
  mediaAppearances: "Media appearance",
  blogPosts: "Blog post",
  in_network: "In network",
  out_of_network: "Out of network",
  both: "In and out of network",
  self_pay_only: "Self-pay only",
};

// Sentences in help text that are notes for developers, not for the editor.
const DEVELOPER_NOTES = [/\bH1\b/, /WCAG/, /Keep hidden false/i, /^Internal\b/, /Stable id/i, /fetched live/i];

export function humanize(name: string): string {
  if (LABELS[name]) {
    return LABELS[name];
  }
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function choiceLabel(value: unknown): string {
  if (typeof value !== "string") {
    return String(value);
  }
  return CHOICE_LABELS[value] ?? humanize(value);
}

function cleanDescription(text: string): string | undefined {
  const kept = text
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !DEVELOPER_NOTES.some((pattern) => pattern.test(sentence)))
    .join(" ")
    .trim();
  return kept.length > 0 ? kept : undefined;
}

function isObject(value: unknown): value is Node {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type Context = { defs: Node; referenceCollection?: string };

function transform(input: unknown, ctx: Context, fieldName?: string): unknown {
  if (!isObject(input)) {
    return input;
  }
  let node: Node = { ...input };

  // Inline local refs, so each use can be shaped for where it appears.
  if (typeof node.$ref === "string") {
    const name = node.$ref.replace(/^#\/(\$defs|definitions)\//, "");
    const { $ref, ...rest } = node;
    node = { ...(ctx.defs[name] as Node), ...rest };
  }

  if (typeof node.title === "string") {
    node.title = plainTitle(node.title);
  } else if (fieldName) {
    node.title = humanize(fieldName);
  }
  if (typeof node.description === "string") {
    const cleaned = cleanDescription(node.description);
    if (cleaned) {
      node.description = cleaned;
    } else {
      delete node.description;
    }
  }
  if (fieldName === "alt" && node.description === undefined) {
    node.description = "Describe the picture for people who use screen readers.";
  }

  // Coded choices -> labelled choices. Same values, so validation is unchanged.
  if (Array.isArray(node.enum)) {
    const { enum: values, ...rest } = node;
    node = { ...rest, oneOf: (values as unknown[]).map((value) => ({ const: value, title: choiceLabel(value) })) };
  }

  // Link targets: name the 2 options instead of "Option 1" / "Option 2".
  for (const key of ["oneOf", "anyOf"] as const) {
    if (Array.isArray(node[key]) && !Array.isArray(input.enum)) {
      node[key] = (node[key] as unknown[]).map((option) => {
        const shaped = transform(option, ctx) as Node;
        const props = isObject(shaped.properties) ? shaped.properties : {};
        if (typeof shaped.title !== "string") {
          if ("internal" in props) {
            shaped.title = "A page on this site";
          } else if ("url" in props) {
            shaped.title = "A web address";
          }
        }
        return shaped;
      });
    }
  }

  if (node.type === "array" || node.items !== undefined) {
    const xui = isObject(node["x-ui"]) ? node["x-ui"] : undefined;
    const collection = typeof xui?.collection === "string" ? xui.collection : undefined;
    if (node.items !== undefined) {
      node.items = transform(node.items, { ...ctx, referenceCollection: collection });
    }
    if (Array.isArray(node.prefixItems)) {
      node.prefixItems = node.prefixItems.map((item) => transform(item, ctx));
    }
  }

  if (isObject(node.properties)) {
    const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    const blockKeepsShowing = typeof input.description === "string" && /Keep hidden false/i.test(input.description);
    const props: Node = {};
    let leftOut = false;

    for (const [name, child] of Object.entries(node.properties)) {
      if (child === true || !isObject(child)) {
        props[name] = child;
        continue;
      }
      const hasDefault = "default" in child;
      const xui = isObject(child["x-ui"]) ? child["x-ui"] : undefined;

      // Written by the AI service on publish, so never in the form.
      if (AI_FIELDS.has(name)) {
        leftOut = true;
        continue;
      }

      // A reference inside a list of clinicians, posts ...: the list already says which
      // collection, so the form leaves it out and fillReferenceCollections adds it on save.
      if (name === "collection" && ctx.referenceCollection) {
        leftOut = true;
        continue;
      }

      const developerOnly =
        DEVELOPER_FIELDS.has(name) ||
        xui?.hidden === true ||
        child.readOnly === true ||
        (name === "hidden" && blockKeepsShowing);
      if (developerOnly && (!required.has(name) || hasDefault)) {
        leftOut = true;
        continue;
      }
      props[name] = transform(child, { defs: ctx.defs }, name);
    }
    node.properties = props;
    // Saved values of left-out fields stay in the data, so the form must allow them.
    if (leftOut) {
      delete node.additionalProperties;
      delete node.unevaluatedProperties;
      node.required = [...required].filter((name) => name in props);
    }
  }

  return node;
}

// The editor's view of 1 zone: a small form with only that zone's block.
export function zoneSchema(schema: JsonSchema, zone: string): JsonSchema {
  const defs = (isObject(schema.$defs) ? schema.$defs : isObject(schema.definitions) ? schema.definitions : {}) as Node;
  const props = isObject(schema.properties) ? schema.properties : {};
  const block = transform(props[zone], { defs }, zone) as Node;
  return {
    type: "object",
    properties: { [zone]: block },
  };
}

// Reference lists need the collection filled in on save, because the form leaves it out.
export function fillReferenceCollections(schema: unknown, data: unknown, defs?: Node): unknown {
  if (!isObject(schema)) {
    return data;
  }
  const allDefs = defs ?? ((isObject(schema.$defs) ? schema.$defs : {}) as Node);
  let node = schema;
  if (typeof node.$ref === "string") {
    node = (allDefs[node.$ref.replace(/^#\/(\$defs|definitions)\//, "")] as Node) ?? node;
  }
  if (Array.isArray(data)) {
    const xui = isObject(node["x-ui"]) ? node["x-ui"] : undefined;
    const collection = typeof xui?.collection === "string" ? xui.collection : undefined;
    return data.map((item) => {
      const filled = fillReferenceCollections(node.items, item, allDefs);
      if (collection && isObject(filled) && filled.collection === undefined) {
        return { ...filled, collection };
      }
      return filled;
    });
  }
  if (isObject(data) && isObject(node.properties)) {
    const out: Node = { ...data };
    for (const [name, child] of Object.entries(node.properties)) {
      if (name in out) {
        out[name] = fillReferenceCollections(child, out[name], allDefs);
      }
    }
    return out;
  }
  return data;
}

// Zone names in render order, with their labels.
export function zonesOf(schema: JsonSchema): { name: string; label: string }[] {
  const props = isObject(schema.properties) ? schema.properties : {};
  const order = (isObject(schema["x-cms"]) && Array.isArray(schema["x-cms"].zones) ? schema["x-cms"].zones : []) as string[];
  const zoneIndex = (name: string) => {
    const child = props[name];
    const zone = isObject(child) && isObject(child["x-cms"]) ? child["x-cms"].zone : undefined;
    const index = typeof zone === "string" ? order.indexOf(zone) : -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const aiOwned = (name: string) => {
    const child = props[name];
    const zone = isObject(child) && isObject(child["x-cms"]) ? child["x-cms"].zone : undefined;
    return AI_FIELDS.has(name) || (typeof zone === "string" && AI_ZONES.has(zone));
  };
  return Object.keys(props)
    .filter((name) => !aiOwned(name))
    .sort((a, b) => zoneIndex(a) - zoneIndex(b))
    .map((name) => {
      const child = props[name];
      const title = isObject(child) && typeof child.title === "string" ? child.title : undefined;
      return { name, label: title ? plainTitle(title) : humanize(name) };
    });
}

// The schema the publish check uses: the stored schema, with the AI-written fields no
// longer required, because the AI service fills them in as part of publish.
export function publishSchema(schema: JsonSchema): JsonSchema {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (!isObject(value)) {
      return value;
    }
    const out: Node = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "required" && Array.isArray(child)) {
        out[key] = child.filter((name) => !AI_FIELDS.has(name as string));
      } else {
        out[key] = walk(child);
      }
    }
    return out;
  };
  return walk(schema) as JsonSchema;
}
