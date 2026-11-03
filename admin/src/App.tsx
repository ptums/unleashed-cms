import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Form from "@rjsf/shadcn";
import type CoreForm from "@rjsf/core";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";
import type { ErrorTransformer, RJSFSchema } from "@rjsf/utils";
import {
  ApiError,
  getDraft,
  getSchema,
  listPages,
  publishPage,
  saveDraft,
  type PageSummary,
  type SchemaRecord,
} from "./api";
import { buildUiSchema, pickSchemaFields } from "./uiSchema";
import { fillReferenceCollections, publishSchema, zoneSchema, zonesOf } from "./editorSchema";

// The schemas are JSON Schema 2020-12 (prefixItems, unevaluatedProperties), so use Ajv2020.
// strict: false lets Ajv ignore the x-cms and x-ui hint keywords.
const validator = customizeValidator({ AjvClass: Ajv2020, ajvOptionsOverrides: { strict: false } });

type Notice = { kind: "ok" | "error" | "info"; text: string };

function pageIdFromHash(): string | undefined {
  const match = window.location.hash.match(/^#\/pages\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [pagesError, setPagesError] = useState<string>();
  const [selected, setSelected] = useState<string | undefined>(pageIdFromHash);

  useEffect(() => {
    listPages()
      .then((list) => {
        setPages(list);
        if (!pageIdFromHash() && list.length > 0) {
          window.location.hash = `#/pages/${encodeURIComponent(list[0].id)}`;
        }
      })
      .catch((error) => {
        setPagesError(errorText(error));
      });
  }, []);

  useEffect(() => {
    const onHash = () => {
      setSelected(pageIdFromHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-card">
        <div className="border-b px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unleashed Potential Therapy Group</p>
          <h1 className="text-lg font-semibold">Content</h1>
        </div>
        <nav className="p-3" aria-label="Pages">
          {pagesError ? <p className="px-2 text-sm text-destructive">{pagesError}</p> : null}
          {!pagesError && pages.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No pages yet. Run the schema sync.</p>
          ) : null}
          <ul className="space-y-1">
            {pages.map((page) => (
              <li key={page.id}>
                <a
                  href={`#/pages/${encodeURIComponent(page.id)}`}
                  aria-current={page.id === selected ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    page.id === selected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {page.title || page.id}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        {selected ? (
          <PageEditor key={selected} id={selected} />
        ) : (
          <p className="p-8 text-muted-foreground">Pick a page to edit.</p>
        )}
      </main>
    </div>
  );
}

// Ajv messages are written for developers. Say the same thing in plain words.
const transformErrors: ErrorTransformer = (errors) =>
  errors.map((error) => {
    const params = (error.params ?? {}) as Record<string, unknown>;
    let message = error.message ?? "This is not valid.";
    switch (error.name) {
      case "required":
        message = "This is required.";
        break;
      case "minLength":
        message = params.limit === 1 ? "This is required." : `Use at least ${String(params.limit)} characters.`;
        break;
      case "maxLength":
        message = `Keep this to ${String(params.limit)} characters or fewer.`;
        break;
      case "minItems":
        message = `Add at least ${String(params.limit)}.`;
        break;
      case "maxItems":
        message = `Use ${String(params.limit)} or fewer.`;
        break;
      case "format":
        message = params.format === "uri" ? "Enter a full web address, starting with https://" : "This is not in the right format.";
        break;
      case "minimum":
      case "maximum":
        message = `Enter a number ${error.name === "minimum" ? "of at least" : "no more than"} ${String(params.limit)}.`;
        break;
      case "oneOf":
      case "anyOf":
      case "const":
      case "enum":
        message = "Pick one of the options.";
        break;
    }
    return { ...error, message, stack: message };
  });

function PageEditor({ id }: { id: string }) {
  const [schemaRecord, setSchemaRecord] = useState<SchemaRecord>();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish">();
  const [notice, setNotice] = useState<Notice>();
  const [zone, setZone] = useState<string>();
  const [zonesWithErrors, setZonesWithErrors] = useState<string[]>([]);
  const [markErrors, setMarkErrors] = useState(false);
  const formRef = useRef<CoreForm>(null);

  useEffect(() => {
    Promise.all([getSchema(id), getDraft(id)])
      .then(([record, draft]) => {
        setSchemaRecord(record);
        setFormData(pickSchemaFields(record.schema, draft));
        setZone(zonesOf(record.schema)[0]?.name);
      })
      .catch((error) => {
        setLoadError(errorText(error));
      });
  }, [id]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty]);

  const zones = useMemo(() => (schemaRecord ? zonesOf(schemaRecord.schema) : []), [schemaRecord]);
  const formSchema = useMemo(
    () => (schemaRecord && zone ? zoneSchema(schemaRecord.schema, zone) : undefined),
    [schemaRecord, zone],
  );
  const uiSchema = useMemo(() => (formSchema ? buildUiSchema(formSchema) : {}), [formSchema]);

  // After publish finds problems and switches zone, mark the fields in that zone.
  useEffect(() => {
    if (markErrors) {
      formRef.current?.validateForm();
      setMarkErrors(false);
    }
  }, [markErrors, zone]);

  const fullData = useCallback(() => {
    if (!schemaRecord) {
      return {};
    }
    const picked = pickSchemaFields(schemaRecord.schema, formData);
    return fillReferenceCollections(schemaRecord.schema, picked) as Record<string, unknown>;
  }, [formData, schemaRecord]);

  // Drafts save even when they are not complete (R10), so no validation here.
  const save = useCallback(async () => {
    const fields = fullData();
    if (Object.keys(fields).length === 0) {
      setNotice({ kind: "info", text: "Nothing to save yet." });
      return false;
    }
    await saveDraft(id, fields);
    setDirty(false);
    return true;
  }, [fullData, id]);

  const onSave = async () => {
    setBusy("save");
    setNotice(undefined);
    try {
      if (await save()) {
        setNotice({ kind: "ok", text: "Draft saved." });
      }
    } catch (error) {
      setNotice({ kind: "error", text: `Save failed: ${errorText(error)}` });
    } finally {
      setBusy(undefined);
    }
  };

  // Strict validation runs only on publish (R11), against the stored schema. The AI-written
  // fields (SEO, image descriptions) are not required here: the AI service adds them.
  const onPublish = async () => {
    if (!schemaRecord) {
      return;
    }
    setBusy("publish");
    setNotice(undefined);
    try {
      const { errors } = validator.validateFormData(fullData(), publishSchema(schemaRecord.schema) as RJSFSchema);
      if (errors.length > 0) {
        const bad = [...new Set(errors.map((error) => (error.property ?? "").split(".")[1]).filter(Boolean))];
        setZonesWithErrors(bad);
        const labels = zones.filter((z) => bad.includes(z.name)).map((z) => z.label);
        setNotice({
          kind: "error",
          text: `Some sections need a fix before you publish: ${labels.join(", ")}. Your draft is not changed.`,
        });
        if (zone && !bad.includes(zone)) {
          setZone(bad[0]);
        }
        setMarkErrors(true);
        return;
      }
      setZonesWithErrors([]);
      await save();
      await publishPage(id);
      setNotice({ kind: "ok", text: "Published. The site shows these changes now." });
    } catch (error) {
      setNotice({ kind: "error", text: `Publish failed: ${errorText(error)}` });
    } finally {
      setBusy(undefined);
    }
  };

  if (loadError) {
    return <p className="p-8 text-destructive">Could not load this page: {loadError}</p>;
  }
  if (!schemaRecord || !formSchema || !zone) {
    return <p className="p-8 text-muted-foreground">Loading…</p>;
  }

  const title = typeof schemaRecord.schema.title === "string" ? schemaRecord.schema.title : id;
  const isHidden = (name: string) => (formData[name] as { hidden?: boolean } | undefined)?.hidden === true;

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-8 py-4 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{dirty ? "You have unsaved changes" : "All changes saved"}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={busy !== undefined || !dirty}
            className="rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={busy !== undefined}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy === "publish" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mx-8 mt-4 rounded-md border px-4 py-3 text-sm ${
            notice.kind === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : notice.kind === "ok"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="flex gap-8 px-8 py-6">
        <nav className="w-52 shrink-0" aria-label="Sections of this page">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sections</p>
          <ol className="space-y-1">
            {zones.map((z) => (
              <li key={z.name}>
                <button
                  type="button"
                  onClick={() => {
                    setZone(z.name);
                  }}
                  aria-current={z.name === zone ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    z.name === zone ? "bg-secondary font-medium text-secondary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <span className={isHidden(z.name) ? "text-muted-foreground line-through" : undefined}>{z.label}</span>
                  {zonesWithErrors.includes(z.name) ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="needs a fix" />
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 max-w-2xl flex-1">
          <Form
            key={zone}
            ref={formRef}
            schema={formSchema as RJSFSchema}
            uiSchema={uiSchema}
            formData={{ [zone]: formData[zone] }}
            validator={validator}
            transformErrors={transformErrors}
            showErrorList={false}
            noHtml5Validate
            onChange={(event) => {
              const next = (event.formData ?? {}) as Record<string, unknown>;
              setFormData((current) => ({ ...current, [zone]: next[zone] }));
              setDirty(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}
