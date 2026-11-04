import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

// GET /admin/uploads/{file}: a signed link to view 1 uploaded image, for the editor's preview.
// The bucket is private, so the browser cannot load an image by its key alone.
// Same signing pattern as create-upload, with a GetObjectCommand.

const s3 = new S3Client({});

function reply(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Only names that create-upload makes: <uuid>.<jpg|png|webp>. This also stops a path
// like "../" from reaching other keys.
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const file = event.pathParameters?.file;

  if (!file || !FILE_NAME.test(file)) {
    return reply(400, { message: "Not an uploaded image" });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.MEDIA_BUCKET_NAME,
    Key: `uploads/${file}`,
  });

  // Signing is local, so a missing file still gets a link. The browser then gets a 403
  // from S3, and the widget shows "No preview".
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });

  return reply(200, { url });
};

export default handler;
