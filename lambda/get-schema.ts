import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const pathId = event.pathParameters?.id;

  if (!pathId) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "no path id" }),
    };
  }

  // 3. The admin edit form always uses the newest schema, so read LATEST.
  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.SCHEMA_TABLE_NAME,
      Key: { pk: `SCHEMA#${pathId}`, sk: "LATEST" },
    }),
  );

  if (!Item) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "No schema found" }),
    };
  }

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    // The sync stores the schema as JSON text, so its field order survives. Older items hold a map.
    body: JSON.stringify({
      id: pathId,
      version: Item.version,
      schema: typeof Item.schema === "string" ? JSON.parse(Item.schema) : Item.schema,
    }),
  };
};

export default handler;
