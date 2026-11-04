// Builds an RJSF uiSchema from the x-cms and x-ui hints in a page's JSON Schema.
// The JSON Schema stays the single source: the form layout is derived, never hand-written.

import type { UiSchema } from "@rjsf/utils";
import type { JsonSchema } from "./api";

type Hints = Record<string, unknown>;

function asObject(value: unknown): Hints | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Hints) : undefined;
}

// Maps 1 x-ui hint to RJSF ui: keys.
function widgetFor(xui: Hints | undefined): UiSchema {
  if (!xui) {
    return {};
  }
  switch (xui.widget) {
    case "textarea":
      return { "ui:widget": "textarea", "ui:options": { rows: typeof xui.rows === "number" ? xui.rows : 4 } };
    case "markdown":
      return {
        "ui:widget": "textarea",
        "ui:options": { rows: 8 },
        "ui:help": "Markdown: **bold**, _italic_, [link](https://...), - list item",
      };
    case "referenceList":
      return { "ui:options": { orderable: xui.sortable !== false } };
    case "image":
      // The whole image object becomes 1 picker (ImageField), not a form per key.
      return { "ui:field": "image" };
    default:
      return {};
  }
}

function build(schema: unknown, defs: Hints): UiSchema {
  let node = asObject(schema);
  if (!node) {
    return {};
  }
  if (typeof node.$ref === "string") {
    const name = node.$ref.replace(/^#\/(\$defs|definitions)\//, "");
    node = { ...asObject(defs[name]), ...node };
  }

  const ui: UiSchema = { ...widgetFor(asObject(node["x-ui"])) };
  if (node.readOnly === true) {
    ui["ui:readonly"] = true;
  }

  const props = asObject(node.properties);
  if (props) {
    for (const [name, child] of Object.entries(props)) {
      const childUi = build(child, defs);
      if (Object.keys(childUi).length > 0) {
        ui[name] = childUi;
      }
    }
  }
  if (node.items !== undefined && typeof node.items === "object") {
    const itemsUi = build(node.items, defs);
    if (Object.keys(itemsUi).length > 0) {
      ui.items = itemsUi;
    }
  }
  return ui;
}

// Top-level fields are zones. Order them by the page's x-cms.zones list.
export function buildUiSchema(schema: JsonSchema): UiSchema {
  const defs = asObject(schema.$defs) ?? asObject(schema.definitions) ?? {};
  const ui = build(schema, defs);

  const props = asObject(schema.properties) ?? {};
  const zones = (asObject(schema["x-cms"])?.zones as string[] | undefined) ?? [];
  const zoneOf = (name: string) => {
    const zone = asObject(asObject(props[name])?.["x-cms"])?.zone;
    const index = typeof zone === "string" ? zones.indexOf(zone) : -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  ui["ui:order"] = [...Object.keys(props).sort((a, b) => zoneOf(a) - zoneOf(b)), "*"];
  ui["ui:submitButtonOptions"] = { norender: true };
  return ui;
}

// Only the fields the schema defines. Drops id, title and other values the API adds.
export function pickSchemaFields(schema: JsonSchema, data: Record<string, unknown>): Record<string, unknown> {
  const props = asObject(schema.properties) ?? {};
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(props)) {
    if (data[name] !== undefined) {
      out[name] = data[name];
    }
  }
  return out;
}
