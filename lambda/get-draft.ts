import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
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

  if (!key) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "no path id" }),
    };
  }

  const { Item } = await client.send(
    new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { pk: key.pk, sk: "DRAFT" },
    }),
  );

  if (!Item) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "No page found" }),
    };
  }

  const { pk, sk, gsi1pk, gsi1sk, ...page } = Item;

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: pathId, ...page }),
  };
};

export default handler;
