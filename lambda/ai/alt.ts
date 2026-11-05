import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

const client = new BedrockRuntimeClient();
const s3 = new S3Client({});

const ALT_TAG_LIMITS = { min: 5, max: 160 };
const modelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";

const altResult = z.object({
  alt: z.string().min(ALT_TAG_LIMITS.min).max(ALT_TAG_LIMITS.max),
});

const SAVE_ALT_TAG: Tool = {
  toolSpec: {
    name: "save_alt_tag",
    description: "Save the image alt tag for a image.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          alt: {
            type: "string",
            description: `Image alt text is a min of ${ALT_TAG_LIMITS.min} characters and a max of ${ALT_TAG_LIMITS.max} characters.`,
          },
        },
        required: ["alt"],
      },
    },
  },
};

// The file extension in the key -> the format name Converse wants.
const FORMATS: Record<string, "jpeg" | "png" | "webp"> = {
  jpg: "jpeg",
  png: "png",
  webp: "webp",
};

const systemPrompt = `You write alt text for images on the website of Unleashed Potential Therapy Group.
  Describe what the image shows, in a phrase that is a min ${ALT_TAG_LIMITS.min} characters and ${ALT_TAG_LIMITS.max} characters.
  Do not start with "Image of" or "Picture of". Use the names in the context, and do not guess names.`;

export async function loadImage(key: string) {
  //  get the extension, the text after the last ".".
  //         "uploads/abc.jpg" -> "jpg". Use split(".") and pop().
  const ext = key.split(".").pop();
  const format = FORMATS[ext as string];

  //  look up the format in FORMATS. If there is none, throw an Error.
  if (!format) {
    throw new Error("unsupported file format");
  }

  // send a GetObjectCommand, with Bucket: process.env.MEDIA_BUCKET_NAME
  //         and Key: key. Same pattern as client.send(new GetCommand(...)).
  const command = new GetObjectCommand({
    Bucket: process.env.MEDIA_BUCKET_NAME,
    Key: key,
  });
  const response = await s3.send(command);
  // the response has a Body. Call await response.Body.transformToByteArray().
  //         Body can be undefined, so throw an Error first if it is missing.

  if (!response?.Body) {
    throw new Error("Image not found: " + key);
  }
  const bytes = await response?.Body.transformToByteArray();

  return { bytes, format };
}

export async function describeImage(key: string, context: string) {
  const { bytes, format } = await loadImage(key);
  const messages: Message[] = [
    {
      role: "user",
      content: [
        { text: `Context: ${context}` },
        {
          image: { format, source: { bytes } },
        },
      ],
    },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.send(
      new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages,
        inferenceConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxTokens: 500,
        },
        toolConfig: {
          tools: [SAVE_ALT_TAG],
          toolChoice: { tool: { name: "save_alt_tag" } },
        },
      }),
    );

    // content is a list of blocks. Find the 1 that holds the tool call.
    const answer = response.output?.message;
    const block = answer?.content?.find((b) => b.toolUse);
    if (!answer || !block?.toolUse) {
      console.error("The model did not call save_alt_tag", response.output);
      throw new Error("The AI service did not return alt tag data");
    }

    // safeParse does not throw. It says if the answer passed, and why not.
    const checked = altResult.safeParse(block.toolUse.input);
    if (checked.success) {
      return checked.data.alt;
    }

    // Tell the model what was wrong, as the result of its tool call, and ask again.
    const problems = checked.error.issues.map((issue) => {
      const field = String(issue.path[0]);
      const value = (
        block.toolUse?.input as Record<string, unknown> | undefined
      )?.[field];
      const length = typeof value === "string" ? value.length : 0;
      return `alt tag is ${length} characters. The limit is between ${ALT_TAG_LIMITS.min} and ${ALT_TAG_LIMITS.max}.`;
    });
    console.warn(
      `alt tag creation ${attempt} failed the check: ${problems.join(" ")}`,
    );
    messages.push(answer, {
      role: "user",
      content: [
        {
          toolResult: {
            toolUseId: block.toolUse.toolUseId,
            status: "error",
            content: [
              {
                text: `${problems.join(" ")} Call save_alt_tag again with text between ${ALT_TAG_LIMITS.min} and ${ALT_TAG_LIMITS.max} characters`,
              },
            ],
          },
        },
      ],
    });
  }

  throw new Error(
    "The AI service returned alt tag data that breaks the limits",
  );
}

type FoundImage = {
  path: (string | number)[];
  assetId: string;
  context: string;
  image: { assetId: string; alt?: string };
};

// An image field is an object with a string assetId, for example { assetId: "uploads/<uuid>.jpg" }.
// "value is { assetId: string }" tells TypeScript: when this returns true, value.assetId is a string.
function isImage(value: unknown): value is { assetId: string } {
  if (typeof value === "object" && value !== null) {
    // "in" checks the key at runtime, and TypeScript also learns that value has assetId.
    if ("assetId" in value) {
      if (typeof value.assetId === "string") {
        return true;
      }
    }
  }

  return false;
}

// Finds every image in a page, at any depth, for example profileHeader.portrait or steps[2].image.
// It looks at 1 value. If the value has children, it calls itself on each child ("recursion").
// path is where we are now, and found is the list that every call adds to.
export function findImages(
  value: unknown,
  pageTitle: string,
  path: (string | number)[] = [],
  found: FoundImage[] = [],
): FoundImage[] {
  // A list: look at each item. Its index goes into the path, for example ["steps", 2].
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findImages(item, pageTitle, [...path, index], found);
    });
    return found;
  }

  // An image: save it. An image has no images inside it, so stop here.
  if (isImage(value)) {
    found.push({
      path,
      assetId: value.assetId,
      context: `Page: ${pageTitle}. Place: ${path.join(" > ")}.`,
      image: value,
    });
    return found;
  }

  // A plain value (text, number, true/false, null): nothing inside it.
  if (typeof value !== "object" || value === null) {
    return found;
  }

  // An object: look at each key. The key goes into the path, for example ["profileHeader", "portrait"].
  for (const [key, child] of Object.entries(value)) {
    // The SEO step owns "seo", and it has no images.
    if (key === "seo") {
      continue;
    }
    findImages(child, pageTitle, [...path, key], found);
  }
  return found;
}

export type AddedAlt = {
  path: (string | number)[];
  assetId: string;
  alt: string;
};

// Writes alt into the page (in place) for each image that has none.
// Returns the new alt texts, so publish can save them to the draft too.
// 1 failed image does not stop the others. It gets alt on the next publish.
export async function addAltText(
  page: Record<string, unknown>,
  pageTitle: string,
): Promise<AddedAlt[]> {
  const images = findImages(page, pageTitle);
  const added: AddedAlt[] = [];

  for (const found of images) {
    if (found.image.alt) {
      continue;
    }
    try {
      const alt = await describeImage(found.assetId, found.context);
      found.image.alt = alt;
      added.push({ path: found.path, assetId: found.assetId, alt });
    } catch (error) {
      console.error(`No alt text for ${found.assetId}`, error);
    }
  }

  return added;
}
