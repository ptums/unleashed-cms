import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { contentKey } from "./content-key";

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // A page (/admin/pages/{id}) or a collection entry (/admin/collections/{type}/entries/{slug}).
  const key = contentKey(event);
  const pathId = key?.id;
  const keys = ["pk", "sk", "gsi1pk", "gsi1sk"];

  if (!key) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "no path id" }),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(event?.body ?? "");
  } catch {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "issue parsing fields data" }),
    };
  }

  // JSON.parse also accepts null, strings, numbers and arrays. Only a plain object is a valid body.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "body must be a JSON object" }),
    };
  }

  const fields = parsed as Record<string, unknown>;

  if (Object.keys(fields).length <= 0) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "No data found" }),
    };
  }

  const badKey = Object.keys(fields).filter((key) => keys.includes(key));

  if (badKey.length > 0) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: `found ${badKey} in results` }),
    };
  }

  // 2. Build expressions dynamically based on what was passed in the body
  const setParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  Object.keys(fields).forEach((field, i) => {
    setParts.push(`#f${i} = :v${i}`);
    names[`#f${i}`] = field;
    values[`:v${i}`] = fields[field];
  });

  const params = {
    TableName: process.env.TABLE_NAME,
    Key: { pk: key.pk, sk: "DRAFT" },
    UpdateExpression: `SET ${setParts.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ConditionExpression: "attribute_exists(pk)",
  };

  // 3. The condition fails when there is no draft for this id, so an unknown id never makes a new page.
  try {
    await client.send(new UpdateCommand(params));
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No page found" }),
      };
    }
    throw error;
  }

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: `Item: ${pathId} has been updated` }),
  };
};

export default handler;
