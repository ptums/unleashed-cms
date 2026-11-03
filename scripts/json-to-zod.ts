// Converts JSON Schema files in json/ into Zod schema files in schema/.
//
//   npm run json-to-zod                      converts every json/*.json
//   npm run json-to-zod -- json/about.json   converts 1 file
//   flags: --force (replace an existing schema file), --out <dir> (default: schema)
//
// json/about.json and json/about.schema.json both become schema/about.ts, so the file
// name is the page id. The output is a starting point: review it, then fit it to the
// zone model (x-cms.kind on the page, x-cms.zone on each top-level field) before sync.
//
// Supported: type (string, number, integer, boolean, array, object, and "null" in a
// type list), enum, const, required, additionalProperties / unevaluatedProperties false,
// $ref to $defs, allOf (merged objects), oneOf / anyOf, prefixItems, min/max keywords,
// pattern, format (uri, email, date-time, date, uuid), default, and boolean schemas.
// title, description, readOnly, contentMediaType, x-cms and x-ui go into .meta().
// Any other keyword stops the run with its path, so nothing is dropped without notice.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Schema = Record<string, unknown> | boolean;
type Obj = Record<string, unknown>;

// Keywords that only describe the schema. They are read, then ignored or moved to .meta().
const IGNORED = new Set(["$schema", "$id", "$comment", "examples", "$defs", "definitions"]);
const META_KEYS = ["title", "description", "readOnly", "contentMediaType", "x-cms", "x-ui"];
const HANDLED = new Set([
  "type", "enum", "const", "required", "properties", "additionalProperties",
  "unevaluatedProperties", "$ref", "allOf", "oneOf", "anyOf", "items", "prefixItems",
  "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "pattern",
  "format", "default", ...META_KEYS, ...IGNORED,
]);

class Converter {
  private defs: Obj;
  private emitted = new Map<string, string>(); // def name -> const name
  private emitting = new Set<string>();
  private lines: string[] = [];
  readonly warnings: string[] = [];

  constructor(private root: Obj, private file: string) {
    this.defs = (root.$defs ?? root.definitions ?? {}) as Obj;
  }

  fail(path: string, message: string): never {
    throw new Error(`${this.file} ${path || "/"}: ${message}`);
  }

  // Returns the const name for a $defs entry, and writes its const the first time.
  refName(ref: string, path: string): string {
    const match = ref.match(/^#\/(\$defs|definitions)\/([^/]+)$/);
    if (!match) {
      this.fail(path, `only local $defs refs are supported, got ${ref}`);
    }
    const name = match[2];
    const done = this.emitted.get(name);
    if (done) {
      return done;
    }
    if (this.emitting.has(name)) {
      this.fail(path, `recursive $ref to ${name} is not supported`);
    }
    if (!(name in this.defs)) {
      this.fail(path, `missing $defs entry ${name}`);
    }
    this.emitting.add(name);
    const expr = this.convert(this.defs[name] as Schema, `/$defs/${name}`, 0);
    this.emitting.delete(name);
    const constName = `${name}Def`;
    this.lines.push(`const ${constName} = ${expr};`, "");
    this.emitted.set(name, constName);
    return constName;
  }

  resolve(schema: Schema, path: string): Schema {
    if (typeof schema === "object" && typeof schema.$ref === "string") {
      const name = schema.$ref.replace(/^#\/(\$defs|definitions)\//, "");
      const target = this.defs[name];
      if (target === undefined) {
        this.fail(path, `missing $defs entry ${name}`);
      }
      return target as Schema;
    }
    return schema;
  }

  // allOf: [{ $ref: base }] plus own properties -> 1 object. A property set to `true`
  // means "defined in the base", so the base definition wins.
  mergeAllOf(schema: Obj, path: string): Obj {
    const parts = (schema.allOf as Schema[]).map((part, i) => this.resolve(part, `${path}/allOf/${i}`));
    const merged: Obj = { type: "object", properties: {}, required: [] as string[] };
    const { allOf, ...own } = schema;
    for (const part of [...parts, own]) {
      if (typeof part !== "object") {
        this.fail(path, "allOf parts must be objects");
      }
      if (part.type !== undefined && part.type !== "object") {
        this.fail(path, "allOf is only supported for object schemas");
      }
      for (const [key, value] of Object.entries(part)) {
        if (key === "properties") {
          const props = merged.properties as Obj;
          for (const [name, prop] of Object.entries(value as Obj)) {
            if (prop === true && name in props) {
              continue;
            }
            props[name] = prop;
          }
        } else if (key === "required") {
          const required = merged.required as string[];
          for (const name of value as string[]) {
            if (!required.includes(name)) {
              required.push(name);
            }
          }
        } else if (key !== "type") {
          merged[key] = value;
        }
      }
    }
    return merged;
  }

  convert(schema: Schema, path: string, depth: number): string {
    const [base, suffix] = this.convertParts(schema, path, depth);
    return base + suffix;
  }

  // Returns the type expression and its .default()/.meta() suffix apart, so an object
  // field can put .optional() between them.
  convertParts(schema: Schema, path: string, depth: number): [string, string] {
    if (schema === true) {
      return ["z.unknown()", ""];
    }
    if (schema === false) {
      return ["z.never()", ""];
    }

    for (const key of Object.keys(schema)) {
      if (!HANDLED.has(key)) {
        this.fail(path, `keyword "${key}" is not supported`);
      }
    }

    let expr: string;
    if (typeof schema.$ref === "string") {
      expr = this.refName(schema.$ref, path);
    } else if (Array.isArray(schema.allOf)) {
      return this.convertParts(this.mergeAllOf(schema, path), path, depth);
    } else if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
      const key = schema.oneOf ? "oneOf" : "anyOf";
      const options = (schema[key] as Schema[]).map((option, i) =>
        this.convert(option, `${path}/${key}/${i}`, depth + 1),
      );
      expr = `z.union([\n${options.map((o) => `${pad(depth + 1)}${o},`).join("\n")}\n${pad(depth)}])`;
    } else if ("const" in schema) {
      expr = `z.literal(${JSON.stringify(schema.const)})`;
    } else if (Array.isArray(schema.enum)) {
      const values = schema.enum as unknown[];
      expr = values.every((v) => typeof v === "string")
        ? `z.enum(${JSON.stringify(values)})`
        : `z.union([${values.map((v) => `z.literal(${JSON.stringify(v)})`).join(", ")}])`;
    } else {
      expr = this.convertType(schema, path, depth);
    }

    return [expr, this.metaSuffix(schema)];
  }

  convertType(schema: Obj, path: string, depth: number): string {
    let types = schema.type;
    let nullable = false;
    if (Array.isArray(types)) {
      nullable = types.includes("null");
      types = types.filter((t) => t !== "null");
      if ((types as string[]).length !== 1) {
        this.fail(path, "a type list may hold 1 type plus null");
      }
      types = (types as string[])[0];
    }
    if (types === undefined && (schema.properties || schema.additionalProperties !== undefined)) {
      types = "object";
    }

    let expr: string;
    switch (types) {
      case "string":
        expr = this.convertString(schema, path);
        break;
      case "number":
      case "integer":
        expr = types === "integer" ? "z.int()" : "z.number()";
        if (typeof schema.minimum === "number") {
          expr += `.min(${schema.minimum})`;
        }
        if (typeof schema.maximum === "number") {
          expr += `.max(${schema.maximum})`;
        }
        break;
      case "boolean":
        expr = "z.boolean()";
        break;
      case "array":
        expr = this.convertArray(schema, path, depth);
        break;
      case "object":
        expr = this.convertObject(schema, path, depth);
        break;
      case undefined:
        this.warnings.push(`${path || "/"}: no type, so it accepts any value`);
        expr = "z.unknown()";
        break;
      default:
        this.fail(path, `type "${String(types)}" is not supported`);
    }
    return nullable ? `${expr}.nullable()` : expr;
  }

  convertString(schema: Obj, path: string): string {
    const formats: Record<string, string> = {
      uri: "z.url()",
      email: "z.email()",
      "date-time": "z.iso.datetime({ offset: true })",
      date: "z.iso.date()",
      uuid: "z.uuid()",
    };
    let expr = "z.string()";
    if (schema.format !== undefined) {
      const formatExpr = formats[schema.format as string];
      if (!formatExpr) {
        this.fail(path, `format "${String(schema.format)}" is not supported`);
      }
      expr = formatExpr;
    }
    if (typeof schema.minLength === "number") {
      expr += `.min(${schema.minLength})`;
    }
    if (typeof schema.maxLength === "number") {
      expr += `.max(${schema.maxLength})`;
    }
    if (typeof schema.pattern === "string") {
      expr += `.regex(new RegExp(${JSON.stringify(schema.pattern)}))`;
    }
    return expr;
  }

  convertArray(schema: Obj, path: string, depth: number): string {
    const items = schema.items === undefined ? "z.unknown()" : this.convert(schema.items as Schema, `${path}/items`, depth);
    if (Array.isArray(schema.prefixItems)) {
      const prefix = (schema.prefixItems as Schema[]).map((item, i) =>
        this.convert(item, `${path}/prefixItems/${i}`, depth + 1),
      );
      let expr = `z.tuple([\n${prefix.map((p) => `${pad(depth + 1)}${p},`).join("\n")}\n${pad(depth)}], ${items})`;
      const checks: string[] = [];
      if (typeof schema.minItems === "number") {
        checks.push(`z.minLength(${schema.minItems})`);
      }
      if (typeof schema.maxItems === "number") {
        checks.push(`z.maxLength(${schema.maxItems})`);
      }
      if (checks.length > 0) {
        expr += `.check(${checks.join(", ")})`;
      }
      return expr;
    }
    let expr = `z.array(${items})`;
    if (typeof schema.minItems === "number") {
      expr += `.min(${schema.minItems})`;
    }
    if (typeof schema.maxItems === "number") {
      expr += `.max(${schema.maxItems})`;
    }
    return expr;
  }

  convertObject(schema: Obj, path: string, depth: number): string {
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    const required = new Set((schema.required ?? []) as string[]);
    const strict = schema.additionalProperties === false || schema.unevaluatedProperties === false;
    if (typeof schema.additionalProperties === "object") {
      this.fail(path, "additionalProperties as a schema is not supported");
    }

    const fields = Object.entries(props).map(([name, prop]) => {
      const [base, suffix] = this.convertParts(prop, `${path}/properties/${name}`, depth + 1);
      const hasDefault = typeof prop === "object" && "default" in prop;
      const optional = !required.has(name) && !hasDefault ? ".optional()" : "";
      return `${pad(depth + 1)}${JSON.stringify(name)}: ${base}${optional}${suffix},`;
    });
    for (const name of required) {
      if (!(name in props)) {
        this.fail(path, `required field "${name}" has no property`);
      }
    }

    const fn = strict ? "z.strictObject" : "z.object";
    return fields.length === 0 ? `${fn}({})` : `${fn}({\n${fields.join("\n")}\n${pad(depth)}})`;
  }

  metaSuffix(schema: Obj): string {
    let suffix = "";
    if ("default" in schema) {
      suffix += `.default(${JSON.stringify(schema.default)})`;
    }
    const meta: Obj = {};
    for (const key of META_KEYS) {
      if (key in schema) {
        meta[key] = schema[key];
      }
    }
    if (Object.keys(meta).length > 0) {
      suffix += `.meta(${JSON.stringify(meta)})`;
    }
    return suffix;
  }

  run(): { body: string; warnings: string[] } {
    const { $defs, definitions, examples, $schema, $id, ...page } = this.root;
    const pageExpr = this.convert(page, "", 0);
    const cms = (this.root["x-cms"] ?? {}) as Obj;
    if (cms.kind !== "singleton" && cms.kind !== "collection") {
      this.warnings.push('x-cms.kind is not "singleton" or "collection", so sync will not create a page');
    }
    const props = (this.root.properties ?? {}) as Record<string, Schema>;
    const noZone = Object.entries(props)
      .filter(([, p]) => typeof p !== "object" || !(p["x-cms"] as Obj | undefined)?.zone)
      .map(([name]) => name);
    if (noZone.length > 0) {
      this.warnings.push(`top-level fields with no x-cms.zone: ${noZone.join(", ")}`);
    }
    return { body: [...this.lines, `export const PAGE = ${pageExpr};`].join("\n"), warnings: this.warnings };
  }
}

function pad(depth: number): string {
  return "  ".repeat(depth);
}

function toCamel(id: string): string {
  return id.replace(/[-_]+(\w)/g, (_, c: string) => c.toUpperCase());
}

function convertFile(file: string, outDir: string, force: boolean) {
  const id = basename(file).replace(/(\.schema)?\.json$/, "");
  const outFile = join(outDir, `${id}.ts`);
  if (existsSync(outFile) && !force) {
    console.log(`${file}: skipped, ${outFile} exists (use --force to replace it)`);
    return;
  }

  const root = JSON.parse(readFileSync(file, "utf8")) as Obj;
  const { body, warnings } = new Converter(root, file).run();
  const name = `${toCamel(id)}Schema`;
  const typeName = `${name[0].toUpperCase()}${name.slice(1, -"Schema".length)}Data`;

  const source = [
    `// Generated from ${file} by scripts/json-to-zod.ts. Review it before you run the sync.`,
    `import { z } from "zod";`,
    "",
    body.replace("export const PAGE =", `export const ${name} =`),
    "",
    `export type ${typeName} = z.infer<typeof ${name}>;`,
    "",
    `export default ${name};`,
    "",
  ].join("\n");

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, source);
  console.log(`${file}: wrote ${outFile}`);
  for (const warning of warnings) {
    console.log(`  warning: ${warning}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "schema";
  if (!outDir) {
    throw new Error("--out needs a directory");
  }
  let files = args.filter((arg, i) => arg.endsWith(".json") && i !== outIndex + 1);
  if (files.length === 0) {
    if (!existsSync("json")) {
      throw new Error("no json/ directory and no files given");
    }
    files = readdirSync("json")
      .filter((name) => name.endsWith(".json"))
      .map((name) => join("json", name));
  }

  let failed = 0;
  for (const file of files) {
    try {
      convertFile(file, outDir, force);
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : error);
    }
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
