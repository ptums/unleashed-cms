import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { reply } from "../utils";

// POST /admin/uploads with { contentType }: returns a signed URL that lets the
// browser PUT 1 image straight into the media bucket, plus the key it will have.

const s3 = new S3Client({});

// The allowed types. The key is the exact content type, the value is the file extension.
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body ?? "");
  } catch {
    return reply(400, { message: `error parsing item body` });
  }

  // An exact lookup: only the 3 types in the map get an extension.
  const contentType = body?.contentType;
  const ext =
    typeof contentType === "string" ? EXTENSIONS[contentType] : undefined;
  if (!ext) {
    return reply(400, { message: "Unsupported file content type" });
  }

  const key = `uploads/${randomUUID()}.${ext}`;

  try {
    // 5. The signature includes the content type, so the browser must send the same one.
    const command = new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // 6. Sign it. Signing is local (no AWS call), and the URL works for 5 minutes.
    //    By default only "host" is signed. signableHeaders adds content-type, so S3
    //    refuses (403) an upload with a different type.
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
      signableHeaders: new Set(["content-type"]),
    });

    // 7. The browser PUTs the file to uploadUrl, then saves key in the image field.
    return reply(200, { uploadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return reply(500, {
      message: "Internal server error generating signature",
    });
  }
};

export default handler;
