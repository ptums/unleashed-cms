import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const { Items } = await client.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "gsi1pk = :p",
      ExpressionAttributeValues: { ":p": "PAGES" },
      ProjectionExpression: "pk, title",
      IndexName: "gsi1",
    }),
  );

  if (Items?.length === 0) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Not found" }),
    };
  }

  const pages = (Items ?? []).map((item) => ({
    id: item.pk.replace(/^PAGE#/, ""),
    title: item.title,
  }));
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pages),
  };
};

export default handler;
