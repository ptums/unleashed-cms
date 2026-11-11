import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { reply } from "../utils";

// GET /collections/{type}/entries: the public list of published slugs in 1 collection.
//
// The published copy has no gsi1pk (see publish-page.ts), so it is not in gsi1.
// 1. Query gsi1 for the drafts of the collection (every entry has a draft).
// 2. BatchGet the PUBLISHED item for each draft. A draft with no published copy drops out.

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// BatchGet takes at most 100 keys per call.
const BATCH_SIZE = 100;

type Key = { pk: string; sk: string };

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const type = event.pathParameters?.type;
  const tableName = process.env.TABLE_NAME!;

  if (!type) {
    return reply(400, { message: "no collection type" });
  }

  const draftSlugs = await listDraftSlugs(tableName, type);
  const keys: Key[] = draftSlugs.map((slug) => ({ pk: `ENTRY#${type}#${slug}`, sk: "PUBLISHED" }));

  const prefix = `ENTRY#${type}#`;
  const slugs: string[] = [];

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const found = await batchGetPks(tableName, keys.slice(i, i + BATCH_SIZE));
    for (const pk of found) {
      slugs.push(pk.slice(prefix.length));
    }
  }

  // An empty collection is a normal state, so it is a 200 with an empty list.
  return reply(200, slugs.sort());
};

// All draft slugs of 1 collection. The query follows LastEvaluatedKey for big collections.
async function listDraftSlugs(tableName: string, type: string): Promise<string[]> {
  const slugs: string[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": `ENTRIES#${type}` },
        ProjectionExpression: "gsi1sk",
        ExclusiveStartKey: startKey,
      }),
    );
    for (const item of page.Items ?? []) {
      slugs.push(String(item.gsi1sk));
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  return slugs;
}

// The pk of each key that has a PUBLISHED item. DynamoDB can return some keys as
// UnprocessedKeys (for example under throttling), so those keys are sent again.
async function batchGetPks(tableName: string, keys: Key[]): Promise<string[]> {
  const pks: string[] = [];
  let pending: Key[] = keys;
  let attempt = 0;

  while (pending.length > 0) {
    if (attempt > 0) {
      await sleep(50 * 2 ** attempt);
    }
    attempt += 1;
    if (attempt > 6) {
      throw new Error(`BatchGet left ${pending.length} keys unprocessed`);
    }

    const result = await client.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: { Keys: pending, ProjectionExpression: "pk" },
        },
      }),
    );

    for (const item of result.Responses?.[tableName] ?? []) {
      pks.push(String(item.pk));
    }
    pending = (result.UnprocessedKeys?.[tableName]?.Keys ?? []) as Key[];
  }

  return pks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default handler;
