// Calls to the CMS admin API. In dev, /api is proxied to the local server.
// VITE_API_BASE overrides it later, for the deployed API Gateway URL.

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type PageSummary = { id: string; title: string };
export type JsonSchema = Record<string, unknown>;
export type SchemaRecord = { id: string; version: number; schema: JsonSchema };
export type PageData = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text.length > 0 ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `${method} ${path} failed (${res.status})`);
  }
  return data as T;
}

export async function listPages(): Promise<PageSummary[]> {
  try {
    return await request<PageSummary[]>("GET", "/admin/pages");
  } catch (error) {
    // list-pages returns 404 when there are no pages yet.
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

export function getSchema(id: string): Promise<SchemaRecord> {
  return request("GET", `/admin/schemas/${encodeURIComponent(id)}`);
}

// What the editor is working on: a page, or 1 entry of a collection.
export type Target = { kind: "page"; id: string } | { kind: "entry"; type: string; slug: string };
export type CollectionSummary = { type: string; title: string };
export type EntrySummary = { slug: string; title: string };

function contentPath(target: Target): string {
  return target.kind === "page"
    ? `/admin/pages/${encodeURIComponent(target.id)}`
    : `/admin/collections/${encodeURIComponent(target.type)}/entries/${encodeURIComponent(target.slug)}`;
}

// A page's schema has the page id. An entry uses its collection's schema.
export function schemaIdOf(target: Target): string {
  return target.kind === "page" ? target.id : target.type;
}

export function getDraft(target: Target): Promise<PageData> {
  return request("GET", contentPath(target));
}

export function saveDraft(target: Target, fields: PageData): Promise<unknown> {
  return request("PUT", contentPath(target), fields);
}

export function publishContent(target: Target): Promise<PageData> {
  return request("POST", `${contentPath(target)}/publish`);
}

export function deleteContent(target: Target): Promise<unknown> {
  return request("DELETE", contentPath(target));
}

export function listCollections(): Promise<CollectionSummary[]> {
  return request("GET", "/admin/collections");
}

export function listEntries(type: string): Promise<EntrySummary[]> {
  return request("GET", `/admin/collections/${encodeURIComponent(type)}/entries`);
}

export function createEntry(type: string, name: string): Promise<{ type: string; slug: string; title: string }> {
  return request("POST", `/admin/collections/${encodeURIComponent(type)}/entries`, { name });
}

// Images. The bucket is private: upload with a signed PUT link, view with a signed GET link.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function requestUpload(contentType: string): Promise<{ uploadUrl: string; key: string }> {
  return request("POST", "/admin/uploads", { contentType });
}

// XMLHttpRequest, because fetch cannot report upload progress.
export function uploadFile(uploadUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    // Must match the type the link was signed for, or S3 refuses it (403).
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => {
      reject(new Error("Upload failed. Check your connection."));
    };
    xhr.send(file);
  });
}

// "uploads/<uuid>.png" -> a signed link that works for 5 minutes.
export async function viewUrl(key: string): Promise<string> {
  const file = key.replace(/^uploads\//, "");
  const { url } = await request<{ url: string }>("GET", `/admin/uploads/${encodeURIComponent(file)}`);
  return url;
}
