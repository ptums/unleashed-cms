import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

// GET /admin/collections: the collection types (clinicians, blog posts ...) for the side bar.
//
// A Scan is fine here: SchemaTable holds 1 LATEST item plus the old versions per schema,
// so it stays tiny (tens of items). The filter keeps only the LATEST items.

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: process.env.SCHEMA_TABLE_NAME,
        FilterExpression: "sk = :latest",
        ExpressionAttributeValues: { ":latest": "LATEST" },
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  const collections = items
    .map((item) => {
      const schema = typeof item.schema === "string" ? JSON.parse(item.schema) : item.schema;
      return {
        type: String(item.pk).replace(/^SCHEMA#/, ""),
        title: typeof schema?.title === "string" ? schema.title : undefined,
        kind: schema?.["x-cms"]?.kind,
      };
    })
    .filter((c) => c.kind === "collection")
    .map(({ type, title }) => ({ type, title: title ?? type }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(collections),
  };
};

export default handler;
