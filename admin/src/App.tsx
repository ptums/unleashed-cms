import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Form from "@rjsf/shadcn";
import { UserButton } from "@clerk/react";
import type CoreForm from "@rjsf/core";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";
import type { ErrorTransformer, RJSFSchema } from "@rjsf/utils";
import {
  ApiError,
  createEntry,
  deleteContent,
  getDraft,
  getSchema,
  listCollections,
  listEntries,
  listPages,
  publishContent,
  saveDraft,
  schemaIdOf,
  type CollectionSummary,
  type EntrySummary,
  type PageSummary,
  type SchemaRecord,
  type Target,
} from "./api";
import { buildUiSchema, pickSchemaFields } from "./uiSchema";
import { ImageField } from "./ImageField";
import { fillReferenceCollections, publishSchema, zoneSchema, zonesOf } from "./editorSchema";

// The schemas are JSON Schema 2020-12 (prefixItems, unevaluatedProperties), so use Ajv2020.
// strict: false lets Ajv ignore the x-cms and x-ui hint keywords.
const validator = customizeValidator({ AjvClass: Ajv2020, ajvOptionsOverrides: { strict: false } });
// Custom fields, by the ui:field name that uiSchema.ts sets.
const FIELDS = { image: ImageField };

type Notice = { kind: "ok" | "error" | "info"; text: string };

// #/pages/<id> is a page. #/c/<type>/<slug> is 1 entry of a collection.
function targetFromHash(): Target | undefined {
  const page = window.location.hash.match(/^#\/pages\/([^/]+)$/);
  if (page) {
    return { kind: "page", id: decodeURIComponent(page[1]) };
  }
  const entry = window.location.hash.match(/^#\/c\/([^/]+)\/([^/]+)$/);
  if (entry) {
    return { kind: "entry", type: decodeURIComponent(entry[1]), slug: decodeURIComponent(entry[2]) };
  }
  return undefined;
}

function hashOf(target: Target): string {
  return target.kind === "page"
    ? `#/pages/${encodeURIComponent(target.id)}`
    : `#/c/${encodeURIComponent(target.type)}/${encodeURIComponent(target.slug)}`;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block truncate rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </a>
  );
}

// 1 collection in the side bar: its entries, and a small form to add a new one.
function CollectionGroup({
  collection,
  entries,
  currentHash,
  onCreated,
}: {
  collection: CollectionSummary;
  entries: EntrySummary[];
  currentHash: string;
  onCreated: (slug: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Type a name first.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const created = await createEntry(collection.type, name);
      setName("");
      setAdding(false);
      onCreated(created.slug);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "There is already one with this name." : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between px-3 pb-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{collection.title}</h2>
        <button
          type="button"
          onClick={() => {
            setAdding((value) => !value);
            setError(undefined);
          }}
          className="rounded px-1.5 text-xs font-medium text-primary hover:bg-accent"
          aria-expanded={adding}
        >
          {adding ? "Cancel" : "+ Add new"}
        </button>
      </div>
      {adding ? (
        <form onSubmit={onSubmit} className="space-y-2 px-3 pb-2">
          <label className="block text-xs text-muted-foreground" htmlFor={`new-${collection.type}`}>
            Name
          </label>
          <input
            id={`new-${collection.type}`}
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder={collection.type === "clinician-profile" ? "e.g. Jess Rebelo" : "e.g. A clear title"}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}
      {entries.length === 0 && !adding ? <p className="px-3 text-sm text-muted-foreground">None yet.</p> : null}
      <ul className="space-y-1">
        {entries.map((entry) => {
          const href = hashOf({ kind: "entry", type: collection.type, slug: entry.slug });
          return (
            <li key={entry.slug}>
              <NavLink href={href} active={href === currentHash}>
                {entry.title || entry.slug}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function App() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [entries, setEntries] = useState<Record<string, EntrySummary[]>>({});
  const [navError, setNavError] = useState<string>();
  const [target, setTarget] = useState<Target | undefined>(targetFromHash);

  const loadEntries = useCallback(async (type: string) => {
    const list = await listEntries(type);
    setEntries((current) => ({ ...current, [type]: list }));
  }, []);

  useEffect(() => {
    Promise.all([listPages(), listCollections()])
      .then(async ([pageList, collectionList]) => {
        setPages(pageList);
        setCollections(collectionList);
        await Promise.all(collectionList.map((c) => loadEntries(c.type)));
        if (!targetFromHash() && pageList.length > 0) {
          window.location.hash = hashOf({ kind: "page", id: pageList[0].id });
        }
      })
      .catch((error) => {
        setNavError(errorText(error));
      });
  }, [loadEntries]);

  useEffect(() => {
    const onHash = () => {
      setTarget(targetFromHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const currentHash = target ? hashOf(target) : "";

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 overflow-y-auto border-r bg-card">
        <div className="flex items-start justify-between gap-2 border-b px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unleashed Potential Therapy Group</p>
            <h1 className="text-lg font-semibold">Content</h1>
          </div>
          <UserButton />
        </div>
        <nav className="p-3 pb-8" aria-label="Content">
          {navError ? <p className="px-2 text-sm text-destructive">{navError}</p> : null}
          <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pages</h2>
          {!navError && pages.length === 0 ? (
            <p className="px-3 text-sm text-muted-foreground">No pages yet. Run the schema sync.</p>
          ) : null}
          <ul className="space-y-1">
            {pages.map((page) => {
              const href = hashOf({ kind: "page", id: page.id });
              return (
                <li key={page.id}>
                  <NavLink href={href} active={href === currentHash}>
                    {page.title || page.id}
                  </NavLink>
                </li>
              );
            })}
          </ul>
          {collections.map((collection) => (
            <CollectionGroup
              key={collection.type}
              collection={collection}
              entries={entries[collection.type] ?? []}
              currentHash={currentHash}
              onCreated={(slug) => {
                void loadEntries(collection.type);
                window.location.hash = hashOf({ kind: "entry", type: collection.type, slug });
              }}
            />
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        {target ? (
          <PageEditor
            key={currentHash}
            target={target}
            onDeleted={() => {
              if (target.kind === "entry") {
                void loadEntries(target.type);
              }
              window.location.hash = pages[0] ? hashOf({ kind: "page", id: pages[0].id }) : "";
            }}
          />
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

function PageEditor({ target, onDeleted }: { target: Target; onDeleted: () => void }) {
  const [draftTitle, setDraftTitle] = useState<string>();
  const [schemaRecord, setSchemaRecord] = useState<SchemaRecord>();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | "delete">();
  const [notice, setNotice] = useState<Notice>();
  const [zone, setZone] = useState<string>();
  const [zonesWithErrors, setZonesWithErrors] = useState<string[]>([]);
  const [markErrors, setMarkErrors] = useState(false);
  const formRef = useRef<CoreForm>(null);

  useEffect(() => {
    Promise.all([getSchema(schemaIdOf(target)), getDraft(target)])
      .then(([record, draft]) => {
        setSchemaRecord(record);
        setDraftTitle(typeof draft.title === "string" ? draft.title : undefined);
        setFormData(pickSchemaFields(record.schema, draft));
        setZone(zonesOf(record.schema)[0]?.name);
      })
      .catch((error) => {
        setLoadError(errorText(error));
      });
  }, [target]);

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
    await saveDraft(target, fields);
    setDirty(false);
    return true;
  }, [fullData, target]);

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
        // The zone is the first part of the error path. A missing zone gives "whoItHelps",
        // and an error inside a zone gives ".hero.heading", so drop a leading dot first.
        const zoneNames = new Set(zones.map((z) => z.name));
        const bad = [
          ...new Set(errors.map((error) => (error.property ?? "").replace(/^\./, "").split(/[.[]/)[0])),
        ].filter((name) => zoneNames.has(name));
        setZonesWithErrors(bad);
        const labels = zones.filter((z) => bad.includes(z.name)).map((z) => z.label);
        setNotice({
          kind: "error",
          text:
            labels.length > 0
              ? `Some sections need a fix before you publish: ${labels.join(", ")}. Your draft is not changed.`
              : "Some fields need a fix before you publish. Your draft is not changed.",
        });
        // Only switch to a real zone. An undefined zone left the editor on "Loading…".
        if (zone && bad.length > 0 && !bad.includes(zone)) {
          setZone(bad[0]);
        }
        setMarkErrors(true);
        return;
      }
      setZonesWithErrors([]);
      await save();
      await publishContent(target);
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

  const schemaTitle = typeof schemaRecord.schema.title === "string" ? schemaRecord.schema.title : schemaIdOf(target);
  // A page shows its own name. An entry shows its name, with its collection under it.
  const title = target.kind === "entry" ? (draftTitle ?? target.slug) : schemaTitle;
  const onDelete = async () => {
    if (!window.confirm(`Delete "${title}"? This removes the draft and the published version, and it cannot be undone.`)) {
      return;
    }
    setBusy("delete");
    try {
      await deleteContent(target);
      setDirty(false);
      onDeleted();
    } catch (error) {
      setNotice({ kind: "error", text: `Delete failed: ${errorText(error)}` });
      setBusy(undefined);
    }
  };
  const isHidden = (name: string) => (formData[name] as { hidden?: boolean } | undefined)?.hidden === true;

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-8 py-4 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {target.kind === "entry" ? `${schemaTitle} · ` : ""}
            {dirty ? "You have unsaved changes" : "All changes saved"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {target.kind === "entry" ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy !== undefined}
              className="rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          ) : null}
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
            fields={FIELDS}
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
