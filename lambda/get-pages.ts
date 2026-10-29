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
      body: JSON.stringify({ message: "no path id" }),
    };
  }

  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { pk: `PAGE#${pathId}`, sk: "PUBLISHED" },
    }),
  );

  if (!Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "No page found" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(Item),
  };
};

export default handler;
