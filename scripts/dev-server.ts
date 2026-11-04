// Local dev server: sends each HTTP route to its Lambda handler, so the CMS runs
// on this machine against the real DynamoDB tables. Local use only: it binds to
// 127.0.0.1 and has no login check.
//
// Run: TABLE_NAME=<content table> SCHEMA_TABLE_NAME=<schema table> MEDIA_BUCKET_NAME=<media bucket> AWS_REGION=us-east-2 npm run dev

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler as getPage } from "../lambda/get-pages";
import { handler as listPages } from "../lambda/list-pages";
import { handler as getDraft } from "../lambda/get-draft";
import { handler as putPage } from "../lambda/put-pages";
import { handler as publishPage } from "../lambda/publish-page";
import { handler as deletePage } from "../lambda/delete-page";
import { handler as getSchema } from "../lambda/get-schema";
import { handler as listCollections } from "../lambda/list-collections";
import { handler as listEntries } from "../lambda/list-entries";
import { handler as createEntry } from "../lambda/create-entry";
import { handler as createUpload } from "../lambda/create-upload";

const PORT = Number(process.env.PORT ?? 3001);

type Route = {
  method: string;
  path: string;
  handler: APIGatewayProxyHandlerV2;
};

// The same routes that API Gateway will have. {name} is a path parameter.
const routes: Route[] = [
  { method: "GET", path: "/pages/{id}", handler: getPage },
  { method: "GET", path: "/admin/pages", handler: listPages },
  { method: "GET", path: "/admin/pages/{id}", handler: getDraft },
  { method: "PUT", path: "/admin/pages/{id}", handler: putPage },
  { method: "POST", path: "/admin/pages/{id}/publish", handler: publishPage },
  { method: "DELETE", path: "/admin/pages/{id}", handler: deletePage },
  { method: "GET", path: "/admin/schemas/{id}", handler: getSchema },
  { method: "GET", path: "/admin/collections", handler: listCollections },
  { method: "GET", path: "/admin/collections/{type}/entries", handler: listEntries },
  { method: "POST", path: "/admin/collections/{type}/entries", handler: createEntry },
  { method: "GET", path: "/admin/collections/{type}/entries/{slug}", handler: getDraft },
  { method: "PUT", path: "/admin/collections/{type}/entries/{slug}", handler: putPage },
  { method: "POST", path: "/admin/collections/{type}/entries/{slug}/publish", handler: publishPage },
  { method: "DELETE", path: "/admin/collections/{type}/entries/{slug}", handler: deletePage },
  { method: "POST", path: "/admin/uploads", handler: createUpload },
];

// "/admin/pages/{id}" -> a regex with 1 capture group per {name}, plus the names.
function compile(path: string): { pattern: RegExp; names: string[] } {
  const names: string[] = [];
  const source = path.replace(/\{([a-zA-Z]+)\}/g, (_, name: string) => {
    names.push(name);
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${source}$`), names };
}

const compiled = routes.map((route) => ({ ...route, ...compile(route.path) }));

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, result: APIGatewayProxyResultV2) {
  // A handler can return a plain string; API Gateway sends that as a 200.
  if (typeof result === "string") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(result);
    return;
  }
  res.writeHead(result.statusCode ?? 200, result.headers as Record<string, string>);
  res.end(result.body ?? "");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const started = Date.now();

  const pathMatches = compiled.filter((route) => route.pattern.test(path));
  const route = pathMatches.find((r) => r.method === method);

  if (!route) {
    // Same split as API Gateway: no route at all is a 404.
    sendJson(res, 404, { message: "Not Found" });
    console.log(`${method} ${path} -> 404 (no route)`);
    return;
  }

  const values = path.match(route.pattern)?.slice(1) ?? [];
  const pathParameters = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(values[i])]));
  const body = await readBody(req);

  // Only the event fields the handlers read. Real API Gateway events have more.
  const event = {
    rawPath: path,
    headers: req.headers,
    pathParameters: route.names.length > 0 ? pathParameters : undefined,
    body: body.length > 0 ? body : undefined,
    requestContext: { http: { method, path } },
  };

  try {
    const result = await route.handler(event as never, {} as never, () => {});
    if (!result) {
      sendJson(res, 500, { message: "Handler returned nothing" });
      console.log(`${method} ${path} -> 500 (no result)`);
      return;
    }
    send(res, result);
    const status = typeof result === "string" ? 200 : (result.statusCode ?? 200);
    console.log(`${method} ${path} -> ${status} (${Date.now() - started} ms)`);
  } catch (error) {
    // In Lambda, a thrown error becomes a 500 from API Gateway.
    console.error(`${method} ${path} -> 500`, error);
    sendJson(res, 500, { message: "Internal Server Error" });
  }
});

for (const name of ["TABLE_NAME", "SCHEMA_TABLE_NAME", "MEDIA_BUCKET_NAME"]) {
  if (!process.env[name]) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CMS dev server on http://127.0.0.1:${PORT}`);
});
