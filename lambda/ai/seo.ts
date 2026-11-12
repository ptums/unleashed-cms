import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import { reply, siteTitle } from "../../utils";
import { fitToLimit } from "./fit";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const client = new BedrockRuntimeClient();

// The env var lets you change the model without a code change. Nova Lite is the default.
const modelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";

// The same names and limits as the "seo" zone in the schemas, so the result can be saved as it is.
const SEO_LIMITS = { title: 60, description: 155 };

// Check 2 of 2: the code checks the model's answer before it trusts it.
// A limit in the prompt is only a request. This is the real check.
const seoResult = z.object({
  title: z.string().min(1).max(SEO_LIMITS.title),
  description: z.string().min(1).max(SEO_LIMITS.description),
});

// Check 1 of 2: the tool. The model must "call" save_seo, so Bedrock returns its answer
// as an object in a toolUse block, not as text. There is no text to parse, so there are
// no backticks to break it.
const SAVE_SEO: Tool = {
  toolSpec: {
    name: "save_seo",
    description: "Save the SEO title and meta description for the page.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: `The page title for search results. At most ${SEO_LIMITS.title} characters.`,
          },
          description: {
            type: "string",
            description: `The meta description. At most ${SEO_LIMITS.description} characters.`,
          },
        },
        required: ["title", "description"],
      },
    },
  },
};

const systemPrompt = `You write SEO metadata for ${siteTitle}, a behavioral health practice.
You get the content of 1 web page as JSON. Some keys are for developers (ids, image files, anchors): ignore them.
Rules:
1. title: engaging, keyword-rich, at most ${SEO_LIMITS.title} characters.
2. description: a short, plain summary that makes a reader want to click, at most ${SEO_LIMITS.description} characters.
3. Do not put the practice name in the title. Count the characters before you answer.
4. Use only facts from the page. Use a warm, calm tone. Do not promise results.
Always answer by calling the save_seo tool.`;

// The answer could not be used: the model did not call the tool, or its answer had no text.
export class SeoAnswerError extends Error {}

// Makes the SEO title and description for 1 page. Publish calls this, and so does the handler below.
export async function generateSeo(content: Record<string, unknown>) {
  // id is a database key, and seo is the old SEO (the model would copy it). Neither helps.
  const { id: _id, seo: _seo, ...page } = content;

  // The conversation so far. A retry adds to it, so the model sees its own answer
  // and what was wrong with it.
  const messages: Message[] = [
    {
      role: "user",
      content: [{ text: `Document Content:\n${JSON.stringify(page)}` }],
    },
  ];

  // 2 tries: the first answer, and 1 retry if the answer breaks a limit.
  let lastInput: unknown;
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
          tools: [SAVE_SEO],
          // Forced: the model must call save_seo. It cannot answer with free text.
          toolChoice: { tool: { name: "save_seo" } },
        },
      }),
    );

    // content is a list of blocks. Find the 1 that holds the tool call.
    const answer = response.output?.message;
    const block = answer?.content?.find((b) => b.toolUse);
    if (!answer || !block?.toolUse) {
      console.error("The model did not call save_seo", response.output);
      throw new SeoAnswerError("The AI service did not return SEO data");
    }

    lastInput = block.toolUse.input;
    // safeParse does not throw. It says if the answer passed, and why not.
    const checked = seoResult.safeParse(block.toolUse.input);
    if (checked.success) {
      return checked.data;
    }

    // Tell the model what was wrong, as the result of its tool call, and ask again.
    const problems = checked.error.issues.map((issue) => {
      const field = String(issue.path[0]);
      const value = (
        block.toolUse?.input as Record<string, unknown> | undefined
      )?.[field];
      const length = typeof value === "string" ? value.length : 0;
      return `${field} is ${length} characters. The limit is ${SEO_LIMITS[field as keyof typeof SEO_LIMITS]}.`;
    });
    console.warn(
      `SEO answer ${attempt} failed the check: ${problems.join(" ")}`,
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
                text: `${problems.join(" ")} Call save_seo again with shorter text.`,
              },
            ],
          },
        },
      ],
    });
  }

  // Both answers were too long. Cut the last one to fit, so the page still gets SEO.
  const last = lastInput as { title?: unknown; description?: unknown } | undefined;
  const trimmed = seoResult.safeParse({
    title: typeof last?.title === "string" ? fitToLimit(last.title, SEO_LIMITS.title) : "",
    description:
      typeof last?.description === "string" ? fitToLimit(last.description, SEO_LIMITS.description) : "",
  });
  if (trimmed.success) {
    console.warn("SEO answer cut to fit the limits", trimmed.data);
    return trimmed.data;
  }
  throw new SeoAnswerError("The AI service returned SEO data that breaks the limits");
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let content: Record<string, unknown>;

  try {
    content = JSON.parse(event.body ?? "");
  } catch {
    return reply(400, { message: `no page content found` });
  }

  // JSON.parse also accepts "null", "3" and "[]". Only an object is a page.
  if (
    content === null ||
    typeof content !== "object" ||
    Array.isArray(content)
  ) {
    return reply(400, { message: "body must be a JSON object" });
  }

  try {
    return reply(200, await generateSeo(content));
  } catch (error) {
    if (error instanceof SeoAnswerError) {
      return reply(502, { message: error.message });
    }
    console.error("Failed to call Bedrock for SEO", error);
    return reply(500, {
      message: "Internal server error processing SEO optimization",
    });
  }
};
