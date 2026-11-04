import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { reply } from "../utils";

// GET /admin/collections/{type}/entries: the drafts of 1 collection, by slug.
// Same pattern as list-pages, on the ENTRIES#<type> partition of gsi1.

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const type = event.pathParameters?.type;

  if (!type) {
    return reply(400, { message: "no collection type" });
  }

  const { Items } = await client.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :p",
      ExpressionAttributeValues: { ":p": `ENTRIES#${type}` },
      ProjectionExpression: "gsi1sk, title",
    }),
  );

  // An empty collection is a normal state, so it is a 200 with an empty list, not a 404.
  const entries = (Items ?? []).map((item) => ({
    slug: item.gsi1sk,
    title: item.title,
  }));

  return reply(200, entries);
};

export default handler;
