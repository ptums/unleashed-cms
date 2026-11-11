import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { contentKey } from "./content-key";
import { reply } from "../utils";

// The public read of published content. 1 Lambda serves 2 routes (see content-key.ts):
//   GET /pages/{id}                          -> a published page
//   GET /collections/{type}/entries/{slug}   -> a published collection entry

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const key = contentKey(event);

  if (!key) {
    return reply(400, { message: "no path id" });
  }

  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { pk: key.pk, sk: "PUBLISHED" },
    }),
  );

  if (!Item) {
    return reply(404, { message: "No page found" });
  }

  const { pk, sk, ...page } = Item;

  return reply(200, page);
};

export default handler;
