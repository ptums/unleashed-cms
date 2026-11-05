import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { contentKey } from "./content-key";
import { reply } from "../utils";
import { addAltText, type AddedAlt } from "./ai/alt";
import { generateSeo } from "./ai/seo";
import { needsSeo } from "./ai/changes";

// 1. Initialize the base client
const baseClient = new DynamoDBClient({});

// 2. Wrap it with the Document Client (automatically handles marshalling/unmarshalling)
const client = DynamoDBDocumentClient.from(baseClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // A page (/admin/pages/{id}) or a collection entry (/admin/collections/{type}/entries/{slug}).
  const key = contentKey(event);
  const pathId = key?.id;

  if (!key) {
    return reply(400, { message: "no path id" });
  }

  // 3. Read the draft and the last published copy. Publish copies what the draft holds now.
  const [draft, published] = await Promise.all([
    client.send(new GetCommand({ TableName: process.env.TABLE_NAME, Key: { pk: key.pk, sk: "DRAFT" } })),
    client.send(new GetCommand({ TableName: process.env.TABLE_NAME, Key: { pk: key.pk, sk: "PUBLISHED" } })),
  ]);

  if (!draft.Item) {
    return reply(404, { message: "No page found" });
  }

  // 4. Drop the keys and the index fields. The published item has no gsi1pk,
  //    so it stays out of gsi1 and the page list shows each page 1 time.
  //    The SEO lives only on the published copy, so any seo in the draft is dropped.
  const { pk, sk, gsi1pk, gsi1sk, seo: _draftSeo, ...page } = draft.Item;
  const oldPage = published.Item ? withoutKeys(published.Item) : undefined;
  const pageTitle = typeof page.title === "string" ? page.title : key.id;

  // 5. The AI steps. If the AI fails, the page still publishes, and the next publish tries again.
  const addedAlts = await addAltText(page, pageTitle);
  const seo = await pickSeo(oldPage, page);

  // 6. Put the copy. A put replaces the old published item, so a re-publish needs no delete.
  await client.send(
    new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: { pk, sk: "PUBLISHED", ...page, ...(seo ? { seo } : {}) },
    }),
  );

  // 7. Save the new alt texts to the draft too. Then the next publish sees them and skips those images.
  await saveAltsToDraft(pk, addedAlts);

  return reply(200, { id: pathId, ...page, ...(seo ? { seo } : {}) });
};

function withoutKeys(item: Record<string, unknown>) {
  const { pk: _pk, sk: _sk, ...rest } = item;
  return rest;
}

// New SEO only on the first publish, or after a big text change (see changes.ts).
// Otherwise, and when the AI fails, keep the old SEO.
async function pickSeo(oldPage: Record<string, unknown> | undefined, page: Record<string, unknown>) {
  const oldSeo = oldPage?.seo;
  if (!needsSeo(oldPage, page)) {
    return oldSeo;
  }
  try {
    return await generateSeo(page);
  } catch (error) {
    console.error("SEO was not made, so the old SEO stays", error);
    return oldSeo;
  }
}

// 1 small update per new alt, for example SET #p0.#p1.alt = :alt for profileHeader.portrait.
// The condition checks that the draft still has the same image. If the editor picked a
// new image while publish ran, that alt is for the old picture, so it is not saved.
async function saveAltsToDraft(pk: string, addedAlts: AddedAlt[]) {
  for (const added of addedAlts) {
    const names: Record<string, string> = {};
    const parts = added.path.map((step, i) => {
      if (typeof step === "number") {
        return `[${step}]`;
      }
      names[`#p${i}`] = step;
      return i === 0 ? `#p${i}` : `.#p${i}`;
    });
    const imagePath = parts.join("");

    try {
      await client.send(
        new UpdateCommand({
          TableName: process.env.TABLE_NAME,
          Key: { pk, sk: "DRAFT" },
          UpdateExpression: `SET ${imagePath}.alt = :alt`,
          ConditionExpression: `${imagePath}.assetId = :assetId`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: { ":alt": added.alt, ":assetId": added.assetId },
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        continue;
      }
      console.error(`Alt text was not saved to the draft for ${added.assetId}`, error);
    }
  }
}

export default handler;
