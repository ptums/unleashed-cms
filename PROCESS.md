# Process

How this CMS was built, step by step. I type every command myself, 1 step at a time.

## The plan

1. AWS infra: cost guardrails first, then the CDK stack (API, DynamoDB, S3 and the admin host).
2. Schema deploys: TypeScript schemas, and a deploy that creates each page.
3. The AI SEO tool.
4. Launch.

## Step 1: cost guardrails (2026-10-28)

The goal: no surprise AWS bill.

1. **Check the CLI identity.** `aws sts get-caller-identity`. It must not be the root user.
2. **Make a private folder for local config.** `mkdir -p ~/.aws-budgets && chmod 700 ~/.aws-budgets`. It is outside the repo, so the files can never be committed.
3. **Write `budget.json` by hand:** a name, a $10 limit, a monthly period and the type `COST`.
4. **Write `notifications.json` by hand:** 4 email alerts (actual 50%, 80%, 100%, and forecast 100%).
5. **Create the budget.** The account ID comes from `$(aws sts get-caller-identity --query Account --output text)`, so I never type it or paste it:

   ```sh
   aws budgets create-budget \
     --account-id "$(aws sts get-caller-identity --query Account --output text)" \
     --budget file://$HOME/.aws-budgets/budget.json \
     --notifications-with-subscribers file://$HOME/.aws-budgets/notifications.json
   ```

6. **Verify** with `aws budgets describe-budgets` and `aws budgets describe-notifications-for-budget`.
7. **Check Cost Anomaly Detection.** A default monitor and a daily email subscription already existed. Its threshold was $100 and 40%, so it would never fire on a $10 budget.
8. **Lower the anomaly threshold** to $5 and 40% with `aws ce update-anomaly-subscription`.

Skipped: free tier alerts (the account is not on the free tier). The cost tag moves to the CDK stack, because a tag needs a resource.

## Step 2: the CDK app (2026-10-28)

1. **Check the tools.** `node -v && npx aws-cdk@latest --version`.
2. **Make the app.** `npx aws-cdk@latest init app --language typescript`. It needs an empty folder.
3. **Pick a region:** us-east-2. The CloudFront certificate goes in us-east-1 later, because AWS requires it there.
4. **Bootstrap the region.** This makes the S3 bucket and IAM roles that CDK uses to deploy:

   ```sh
   npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-2
   ```

   Verified: the `CDKToolkit` stack is `CREATE_COMPLETE`.

5. **Set the stack `env`** in `bin/unleashed-cms.ts` from `process.env.CDK_DEFAULT_ACCOUNT` and `process.env.CDK_DEFAULT_REGION`. The CDK CLI fills both in from my login, so no account ID goes in the code.
6. **Block `.env` files.** I made a `.env` by mistake. It was not ignored, so I deleted it and added `.env*` to `.gitignore`.
7. **Tag everything.** `cdk.Tags.of(app).add("project", "unleashed-cms")` tags every stack and resource in the app.

## Step 3: the DynamoDB content table (2026-10-28)

1. **List the access patterns:**
   - List the pages (sorted by title).
   - Get 1 page (all fields, or some with a `ProjectionExpression`).
   - Update fields on 1 page (`UpdateItem` with `SET`).
   - Publish or unpublish a page.
   - The website reads the published version of a page.
2. **Design the keys.** Each page has 2 items, so edits stay hidden until publish:

   | pk | sk | what it is |
   |----|----|------------|
   | `PAGE#home` | `DRAFT` | the working copy |
   | `PAGE#home` | `PUBLISHED` | what the website reads |

   Publish copies DRAFT to PUBLISHED. Unpublish deletes PUBLISHED.
3. **Add a sparse index (`gsi1`) to list pages.** Only DRAFT items get `gsi1pk = "PAGES"`, so the index holds each page once. `gsi1sk` is the title in lowercase, so the list sorts by title.
4. **Write the table in CDK** with `TableV2`: on-demand billing, and `RemovalPolicy.RETAIN` so a stack delete never deletes content.
5. **Check the synth output**, not only that it passes. The first version had the index on `pk`/`sk`, then `gsi1sk` twice. Both passed the synth.

6. **Check the diff, then deploy.** `npx cdk diff` showed only `[+]` (create) lines. `npx cdk deploy` made the stack. Verified: the table is `ACTIVE`, on-demand, and `gsi1` is `ACTIVE` with `gsi1pk`/`gsi1sk`.

## Step 4: test the keys by hand (2026-10-28)

1. **Save the table name** in a shell variable, `TABLE`, from `aws cloudformation describe-stack-resources`.
2. **Write test items** in DynamoDB JSON: `seed/home-draft.json` (with `gsi1pk` and `gsi1sk`) and `seed/home-published.json` (without them).
3. **Put each item** with `aws dynamodb put-item --item file://seed/...`.
4. **List the pages** with `aws dynamodb query --index-name gsi1` and `gsi1pk = :p`.

Result: the main table holds 2 Home items (DRAFT and PUBLISHED), and the index holds 1. The sparse index works.

## Step 5: the first Lambda (started 2026-10-28)

1. **Install** `esbuild` and `@types/aws-lambda` (dev), plus `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`.
2. **Write the handler** `lambda/get-pages.ts`: it reads `PAGE#<id>` / `PUBLISHED` with `GetCommand`, and returns 200, 404 or 400.
3. **Review fixes:** a stray auto-import, a template string in double quotes, checking the whole response in place of `Item`, and sending the whole response in the body.
4. **Run it locally** with `tsx` and a fake event against the real table:

   ```sh
   TABLE_NAME=$TABLE AWS_REGION=us-east-2 npx tsx -e "import { handler } from './lambda/get-pages.ts'; handler({ pathParameters: { id: 'home' } } as any, {} as any, () => {}).then((r) => console.log(r));"
   ```

   Verified: 200 for `home`, 404 for a missing page, 400 with no id.

## Next

* Step 5, part 1: the function in CDK (`NodejsFunction`), with only `dynamodb:GetItem`.
* Step 5, part 2: the HTTP API route `GET /pages/{id}`.
* Turn on the `project` cost allocation tag (it shows in Billing up to 24 hours after the first tagged resource).
