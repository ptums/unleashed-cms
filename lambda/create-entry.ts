import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { reply, toSlug } from "../utils";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // 1. The type comes from the path: /admin/collections/{type}/entries
  const type = event.pathParameters?.type;

  if (!type) {
    return reply(400, { message: "no type" });
  }

  // 2. The type must have a schema, and that schema must be a collection.
  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.SCHEMA_TABLE_NAME,
      Key: { pk: `SCHEMA#${type}`, sk: "LATEST" },
    }),
  );

  if (!Item) {
    return reply(404, { message: "no schema found" });
  }

  const schema = JSON.parse(Item.schema);

  if (schema["x-cms"]?.kind !== "collection") {
    return reply(400, { message: `${type} is not a collection` });
  }

  // 3. The body must be JSON with a name in it. Same try/catch as put-pages.
  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "");
  } catch {
    return reply(400, { message: `error parsing item body` });
  }

  const name = (body as { name?: unknown })?.name;

  if (typeof name !== "string" || name?.trim() === "") {
    return reply(400, { message: "name is required" });
  }

  // 4. Make the slug.
  const slug = toSlug(name);

  if (slug === "") {
    return reply(400, {
      message: "name needs at least 1 letter or number",
    });
  }

  // 5. Write the draft. The condition refuses a slug that is already taken.
  try {
    await client.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          pk: `ENTRY#${type}#${slug}`,
          sk: "DRAFT",
          gsi1pk: `ENTRIES#${type}`,
          gsi1sk: slug,
          title: name.trim(),
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  } catch (error) {
    // 6. same shape as put-pages:
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return reply(409, {
        message: "An entry with this name already exists",
      });
    }
    throw error;
  }

  // 7. return reply(201, { type, slug, title: name.trim() });
  return reply(201, {
    type,
    slug,
    title: name.trim(),
  });
};

export default handler;
