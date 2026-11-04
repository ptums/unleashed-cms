import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { reply } from "../utils";

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const pathId = event.pathParameters?.id;

  if (!pathId) {
    return reply(400, { message: "no path id" });
  }

  // 3. The admin edit form always uses the newest schema, so read LATEST.
  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.SCHEMA_TABLE_NAME,
      Key: { pk: `SCHEMA#${pathId}`, sk: "LATEST" },
    }),
  );

  if (!Item) {
    return reply(404, { message: "No schema found" });
  }

  return reply(200, {
    id: pathId,
    version: Item.version,
    schema:
      typeof Item.schema === "string" ? JSON.parse(Item.schema) : Item.schema,
  });
};

export default handler;
