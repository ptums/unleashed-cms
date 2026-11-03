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

5. **The function in CDK:** `NodejsFunction` (esbuild bundles the TS), `TABLE_NAME` from `table.tableName`, and `table.grant(fn, "dynamodb:GetItem")` for least privilege. Verified with `aws lambda invoke`: 200 and 404.
6. **The HTTP API:** `HttpApi` with the route `GET /pages/{id}`, `HttpLambdaIntegration`, and a `CfnOutput` for the URL. Verified with `curl`: 200, 404 from my code, and 404 from API Gateway when no route matches.
7. **Rate limit:** `HttpApi` has no throttle option for its default stage, so I used an escape hatch: `api.defaultStage!.node.defaultChild as apigwv2.CfnStage`, then `defaultRouteSettings` with a rate of 2 per second and a burst of 10. The diff showed only `[~]`. Verified: the stage shows the limits, and a burst of 30 parallel calls got a `429`.

8. **Clean the response:** `const { pk, sk, ...page } = Item;` sends only the page fields. Verified: `{"title":"Home"}`.
9. **Set the content type:** each return sends `content-type: application/json`. Verified on the 200 and the 404.

## Cost tag (2026-10-29)

The day after the first deploy, `aws ce list-cost-allocation-tags --tag-keys project` showed `UserDefined Inactive`. `aws ce update-cost-allocation-tags-status --cost-allocation-tags-status TagKey=project,Status=Active` turned it on. Verified: the status is `Active`.

## Step 6: the admin routes (started 2026-10-28)

Login decision: Clerk, not Cognito (REQUIREMENTS R16, R17). An API Gateway JWT authorizer will check the Clerk token. Until it exists, admin routes are built and tested locally only, never deployed.

| Route | Handler | DynamoDB call | Status |
|-------|---------|---------------|--------|
| `GET /admin/pages` | `lambda/list-pages.ts` | `Query` on `gsi1` | works locally |
| `GET /admin/pages/{id}` | `lambda/get-draft.ts` | `GetItem` (DRAFT) | works locally |
| `PUT /admin/pages/{id}` | `lambda/put-pages.ts` | `UpdateItem` (DRAFT) | works locally |
| `POST /admin/pages/{id}/publish` | `lambda/publish-page.ts` | `GetItem` (DRAFT) + `PutItem` (PUBLISHED) | works with a stub client |
| `DELETE /admin/pages/{id}` | `lambda/delete-page.ts` | `TransactWrite` (2 deletes) | works locally |
| `GET /admin/schemas/{id}` | `lambda/get-schema.ts` | `GetItem` (LATEST, on `SchemaTable`) | works locally |

Notes:

* `list-pages` returns 404 when there are no pages. The admin UI must treat that as "no pages yet".
* `delete-page` deletes the DRAFT and PUBLISHED items in 1 transaction. A condition on the draft makes an unknown id fail (404), and nothing is deleted. Tested on throwaway pages: 204, then 404, and a draft-only page gives 204.
* Who writes what: I write each new pattern by hand. Claude takes over repeat work (more CRUD routes on a known pattern) and the admin UI.
* `list-pages` builds each `id` from `pk` with `.replace(/^PAGE#/, "")`.
* `put-pages` (2026-11-02) edits the DRAFT only. It parses the body, then returns 400 for bad JSON, a body that is not a plain object (`null`, arrays, strings), an empty object, or a blocked key (`pk`, `sk`, `gsi1pk`, `gsi1sk`). It builds `SET #f0 = :v0, ...` with a loop over the body keys, so reserved words such as `name` are safe. `attribute_exists(pk)` makes an unknown id fail with `ConditionalCheckFailedException`, which returns 404, so an update never makes a new page.
* Tested locally: no id, bad JSON, `null`, an array, `{}` and `{"pk":"x"}` each give 400. An unknown id gives 404. A throwaway draft `zz-test` gives 200, with `title` and `name` updated and `gsi1sk` unchanged.
* `gsi1sk` holds the page id, not the title (see `seed/home-draft.json`), so a title change does not touch it. The old plan to update `gsi1sk` on a title change is dropped.

* `publish-page` (2026-11-02, written by Claude at Peter's request) gets the DRAFT (404 when missing), drops `sk`, `gsi1pk` and `gsi1sk`, and puts the copy as `PUBLISHED`. The put replaces the old published item. With no `gsi1pk`, the published item stays out of `gsi1`. Tested with a stubbed `send`: no id gives 400, a missing draft gives 404 with no put, and a draft gives 200 with the right put item. Not yet run against the real table.
* Publish parts that need schemas come later: strict validation (R11), removing hidden fields (R13), the AI SEO step (R12) and the revalidate webhook (R14).
* Page creation is not a route: a schema deploy creates its page (R4). The page Lambdas are complete for now.

## Step 7: schemas (started 2026-11-02)

1. **Library:** Zod 4 (Peter's pick over TypeBox). `z.toJSONSchema()` gives JSON Schema 2020-12, and `.meta()` passes `x-cms` and `x-ui` through as they are. A second `.meta()` replaces the first, so each field gets 1 `.meta()`, and the page meta goes on the object.
2. **Schema files** live in `schema/` (R1 says `schemas/`; to be made the same). The file name is the page id, and the schema is the default export. First file: `schema/home.ts`, a `singleton` with zones `hero` and `body`. `order` counts inside each zone.
3. **`SchemaTable`** (N10): `pk = SCHEMA#<id>`, `sk = VERSION#<n>` or `LATEST`, no index, `RETAIN`. Deployed.
4. **`scripts/sync-schemas.ts`** runs after `cdk deploy`, with `SCHEMA_TABLE_NAME` and `CONTENT_TABLE_NAME` set. For each schema file, it:
   * creates the DRAFT page for a `singleton` with `attribute_not_exists(pk)`, so it never replaces a draft (R4);
   * reads `LATEST`, and skips the schema when the JSON is the same;
   * otherwise writes `VERSION#<n+1>` and `LATEST` in 1 transaction.

   Verified on the real schema table: the first run wrote version 1, and the second said `unchanged`. The draft-page part was verified with a stubbed client (created, then exists).

5. **Key-order fix:** DynamoDB does not keep the key order of a map, so `JSON.stringify` saw a changed schema on every run and wrote a new version each time (Home reached version 4). The script now compares with `stableStringify`, which sorts keys at every level. Verified: 2 runs on the real tables both print `unchanged`.

## Step 8: local dev server (2026-11-02)

`scripts/dev-server.ts` (`npm run dev`) sends the 7 routes to their Lambda handlers on `127.0.0.1:3001`, against the real tables. It has no login, so it is local only. `npm run sync` runs the schema sync.

End-to-end test with a new schema, `schema/about.ts` (a `singleton` with zones `hero`, `body` and `aside`):

1. `npm run sync`: `about: draft page created`, `about: version 1 written`.
2. `GET /admin/pages` lists `about`. `GET /admin/schemas/about` returns its schema. `GET /pages/about` is 404 (not published yet).
3. `PUT /admin/pages/about` with `heroTitle` and `intro`: 200, and the draft shows both.
4. `POST /admin/pages/about/publish`: 200. `GET /pages/about` now returns the content.

This also verified `publish-page` and the sync's draft-page part on the real tables. Test data left in the tables: the `about` page (draft and published, test text) and the `zz-test` draft.

Also done 2026-11-02: npm packages updated. Jest was at 25 (an `npm audit fix --force` downgrade) and caused all the critical and high audit issues. Back on Jest 30, there are 0 critical and 0 high. Do not run `npm audit fix --force` here.

## Next

* The admin UI (option 2): Vite + React app with the page list and a react-jsonschema-form edit form, against the dev server.
* Make the Clerk app, then add the JWT authorizer and deploy the admin routes.
