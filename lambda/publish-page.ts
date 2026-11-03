import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
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

  // 3. Read the draft. Publish copies whatever the draft holds now.
  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { pk: `PAGE#${pathId}`, sk: "DRAFT" },
    }),
  );

  if (!Item) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "No page found" }),
    };
  }

  // 4. Drop the keys and the index fields. The published item has no gsi1pk,
  //    so it stays out of gsi1 and the page list shows each page 1 time.
  //    Schema validation (R11), hidden fields (R13) and the revalidate webhook (R14)
  //    come with the schema work.
  const { pk, sk, gsi1pk, gsi1sk, ...page } = Item;

  // 5. Put the copy. A put replaces the old published item, so a re-publish needs no delete.
  await client.send(
    new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: { pk, sk: "PUBLISHED", ...page },
    }),
  );

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: pathId, ...page }),
  };
};

export default handler;
