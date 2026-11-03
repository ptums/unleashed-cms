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

export function getDraft(id: string): Promise<PageData> {
  return request("GET", `/admin/pages/${encodeURIComponent(id)}`);
}

export function saveDraft(id: string, fields: PageData): Promise<unknown> {
  return request("PUT", `/admin/pages/${encodeURIComponent(id)}`, fields);
}

export function publishPage(id: string): Promise<PageData> {
  return request("POST", `/admin/pages/${encodeURIComponent(id)}/publish`);
}
