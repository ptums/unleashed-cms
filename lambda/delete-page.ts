import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
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

  // 3. Delete the draft and the published copy together, so a page is never half deleted.
  //    The condition on the draft makes an unknown id fail, and the transaction rolls back.
  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: process.env.TABLE_NAME,
              Key: { pk: key.pk, sk: "DRAFT" },
              ConditionExpression: "attribute_exists(pk)",
            },
          },
          {
            Delete: {
              TableName: process.env.TABLE_NAME,
              Key: { pk: key.pk, sk: "PUBLISHED" },
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TransactionCanceledException") {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No page found" }),
      };
    }
    throw error;
  }

  return {
    statusCode: 204,
    body: "",
  };
};

export default handler;
