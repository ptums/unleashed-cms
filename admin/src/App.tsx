import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Form from "@rjsf/shadcn";
import type CoreForm from "@rjsf/core";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";
import type { RJSFSchema } from "@rjsf/utils";
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Up Therapy Group</p>
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

function PageEditor({ id }: { id: string }) {
  const [schemaRecord, setSchemaRecord] = useState<SchemaRecord>();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish">();
  const [notice, setNotice] = useState<Notice>();
  const formRef = useRef<CoreForm>(null);

  useEffect(() => {
    Promise.all([getSchema(id), getDraft(id)])
      .then(([record, draft]) => {
        setSchemaRecord(record);
        setFormData(pickSchemaFields(record.schema, draft));
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

  const uiSchema = useMemo(() => (schemaRecord ? buildUiSchema(schemaRecord.schema) : {}), [schemaRecord]);

  // Drafts save even when they are not complete (R10), so no validation here.
  const save = useCallback(async () => {
    if (!schemaRecord) {
      return false;
    }
    const fields = pickSchemaFields(schemaRecord.schema, formData);
    if (Object.keys(fields).length === 0) {
      setNotice({ kind: "info", text: "Nothing to save yet." });
      return false;
    }
    await saveDraft(id, fields);
    setDirty(false);
    return true;
  }, [formData, id, schemaRecord]);

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

  // Strict validation runs only on publish (R11). Save first, so publish copies these edits.
  const onPublish = async () => {
    setBusy("publish");
    setNotice(undefined);
    try {
      const valid = formRef.current?.validateForm() ?? false;
      if (!valid) {
        setNotice({ kind: "error", text: "Fix the marked fields before you publish. Your draft is not changed." });
        return;
      }
      await save();
      await publishPage(id);
      setNotice({ kind: "ok", text: "Published." });
    } catch (error) {
      setNotice({ kind: "error", text: `Publish failed: ${errorText(error)}` });
    } finally {
      setBusy(undefined);
    }
  };

  if (loadError) {
    return <p className="p-8 text-destructive">Could not load this page: {loadError}</p>;
  }
  if (!schemaRecord) {
    return <p className="p-8 text-muted-foreground">Loading…</p>;
  }

  const title = typeof schemaRecord.schema.title === "string" ? schemaRecord.schema.title : id;
  const route = (schemaRecord.schema["x-cms"] as { route?: string } | undefined)?.route;

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-8 py-4 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {route ? `${route} · ` : ""}schema v{schemaRecord.version}
            {dirty ? " · unsaved changes" : ""}
          </p>
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

      <div className="max-w-3xl px-8 py-6">
        <Form
          ref={formRef}
          schema={schemaRecord.schema as RJSFSchema}
          uiSchema={uiSchema}
          formData={formData}
          validator={validator}
          showErrorList={false}
          noHtml5Validate
          onChange={(event) => {
            setFormData(event.formData as Record<string, unknown>);
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}
