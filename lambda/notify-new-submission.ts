import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { DynamoDBStreamHandler } from "aws-lambda";

// The anonymous alert for each new website form submission (ported from jessrebelo.com,
// docs/AWS-SETUP.md part 5 there). The stream filter sends only new sub# items here.
// The alert holds metadata only: ID, form, spam check, time. The submission itself
// (names, contact details, text) is only in the Sheet and in Jess's email.

const sns = new SNSClient({});

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    const item = record.dynamodb?.NewImage;
    if (!item?.pk?.S) {
      continue;
    }
    const id = item.pk.S.replace("sub#", "");
    const formType = item.formType?.S ?? "unknown";
    const spamResult = item.spamResult?.S ?? "unknown";
    const isTest = item.isTest?.BOOL ? " [TEST]" : "";

    await sns.send(
      new PublishCommand({
        TopicArn: process.env.TOPIC_ARN,
        Subject: `New ${formType} submission${isTest}`,
        Message: `ID: ${id}\nForm: ${formType}\nSpam check: ${spamResult}\nTime: ${item.createdAt?.S ?? ""}`,
      }),
    );
  }
};
