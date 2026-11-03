import { readdirSync } from "node:fs";
import { z } from "zod";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

// DynamoDB does not keep the key order of a map, so the same schema can come back
// with its keys in a different order. Sort the keys at every level before comparing.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  const contentTableName = process.env.CONTENT_TABLE_NAME;
  if (!contentTableName) {
    throw new Error("CONTENT_TABLE_NAME is not set");
  }

  const tableName = process.env.SCHEMA_TABLE_NAME;
  if (!tableName) {
    throw new Error("SCHEMA_TABLE_NAME is not set");
  }

  const files = readdirSync("schema").filter((name) => name.endsWith(".ts"));

  for (const file of files) {
    const id = file.replace(/\.ts$/, "");
    const mod = await import(`../schema/${id}`);
    const schema = mod.default;

    if (!(schema instanceof z.ZodType)) {
      throw new Error(id);
    }

    // "input" mode: a field with a default stays optional, as in the JSON source.
    // The default "output" mode marks it required, and Ajv then rejects data that leaves it out.
    const json = z.toJSONSchema(schema, { io: "input" });
    const cms = json["x-cms"] as { kind?: string } | undefined;

    if (cms?.kind === "singleton") {
      try {
        await client.send(
          new PutCommand({
            TableName: contentTableName,
            Item: {
              pk: `PAGE#${id}`,
              sk: "DRAFT",
              gsi1pk: "PAGES",
              gsi1sk: id,
              title: json.title,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        );
        console.log(`${id}: draft page created`);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "ConditionalCheckFailedException"
        ) {
          console.log(`${id}: draft page exists`);
        } else {
          throw error;
        }
      }
    }

    const { Item } = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: `SCHEMA#${id}`, sk: "LATEST" },
      }),
    );

    if (stableStringify(Item?.schema) === stableStringify(json)) {
      console.log(`id: ${id} unchanged`);
      continue;
    }

    const version = (Item?.version ?? 0) + 1;

    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                pk: `SCHEMA#${id}`,
                sk: `VERSION#${version}`,
                schema: json,
                version,
              },
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                pk: `SCHEMA#${id}`,
                sk: `LATEST`,
                schema: json,
                version,
              },
            },
          },
        ],
      }),
    );

    console.log(`${id}: version ${version} written`);
  }
}
main();
