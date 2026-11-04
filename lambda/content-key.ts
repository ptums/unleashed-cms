import type { APIGatewayProxyEventV2 } from "aws-lambda";

// The partition key for a page or a collection entry, from the route's path parameters.
//   /admin/pages/{id}                          -> PAGE#<id>
//   /admin/collections/{type}/entries/{slug}   -> ENTRY#<type>#<slug>
// The DRAFT and PUBLISHED items share this key, so the same handlers serve both kinds.
export function contentKey(event: APIGatewayProxyEventV2): { pk: string; id: string } | undefined {
  const params = event.pathParameters ?? {};
  if (params.type && params.slug) {
    return { pk: `ENTRY#${params.type}#${params.slug}`, id: params.slug };
  }
  if (params.id) {
    return { pk: `PAGE#${params.id}`, id: params.id };
  }
  return undefined;
}
