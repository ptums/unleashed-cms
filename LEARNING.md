# Learning

What I learned while building this CMS. Each item is short, so I can turn it into a post later.

## AWS cost guardrails

* **A budget is the first resource, before any real resource.** It costs nothing and it catches mistakes early.
* **Use 4 alerts, not 1.** Actual spend at 50%, 80% and 100% shows the trend. The forecast alert at 100% warns me before the money is gone.
* **Budgets and Anomaly Detection do different jobs.** A budget watches the monthly total. Anomaly Detection watches for a strange spike, for example a Lambda in a loop.
* **Check the defaults.** AWS had already made an anomaly monitor and subscription. Its threshold was $100 and 40%. On a $10 budget it would never fire, so I lowered it to $5.
* **There is no test-alert button for budgets** (I found none). The first real alert email is the true test.
* **A cost tag needs a resource.** You can't tag an empty account. The tag goes on the CDK stack, and you turn it on for cost reports after the first deploy.

## Keeping a public repo clean

* **Get the account ID with `$(...)`.** `$(aws sts get-caller-identity --query Account --output text)` puts the ID in the command, so I never type it or paste it.
* **Local config lives outside the repo.** The budget files hold my email, so they live in `~/.aws-budgets/` with `chmod 700`. If a file is not in the repo folder, git can't commit it.
* **Hide output before you share it.** ARNs hold the account ID. `--query` can pick only the safe fields.

* **CDK does not read `.env` files.** The CDK CLI sets `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` itself. A `.env` with those values adds nothing, and the CDK `.gitignore` does not block it. Add `.env*` to `.gitignore` on day 1.
* **`Tags.of(app)` tags everything** inside the app, and the line can go anywhere in the file, because CDK applies tags at synth time.
* **Typos in tags split cost reports.** `uptherapgy-cms` and `uptherapy-cms` would show as 2 projects.

## DynamoDB

* **Design from the questions, not the data.** In SQL you design tables, then write any query. In DynamoDB you list the access patterns first, then design the keys to answer them.
* **1 pattern can cover many fields.** "Get the title" and "update the title" are the same patterns as "get a page" and "update a page". `ProjectionExpression` and `UpdateExpression` pick the fields.
* **Draft and published are 2 items, not 1 status field.** Then half-done edits never reach the live site.
* **A sparse index is free filtering.** Only items that have the index key go in the index. Put `gsi1pk` only on DRAFT items, and the index lists each page once.
* **DynamoDB sorts by bytes.** "Home" sorts before "about", so store the sort key in lowercase.
* **A passing synth does not mean a correct design.** CDK checks types, not meaning. Read the synth output.
* **`AttributeType` is not `KeyType`.** `AttributeType` is the data type (`S`, `N`, `B`). `KeyType` in the template is the role: `HASH` is the partition key, `RANGE` is the sort key.
* **DynamoDB JSON wraps each value with its type:** `{ "S": "Home" }`. Numbers go in quotes too: `{ "N": "5" }`.
* **`Count` vs `ScannedCount`.** `ScannedCount` is how many items DynamoDB read. `Count` is how many it returned after a filter. You pay for `ScannedCount`, so a filter does not make a read cheaper. A good key or a sparse index does.
* **Prove the test, not only the output.** My first `put-item` failed with no error I noticed, and the index count looked right anyway. Check the main table too, so you know the test really ran.

## Lambda

* **Make the SDK client outside the handler.** Lambda reuses it on warm calls.
* **`send()` returns a response, not the item.** The page is in `Item`. The response is always an object, so `if (!response)` never catches a missing page.
* **Template strings need backticks.** `"PAGE#${id}"` is plain text.
* **Watch auto-imports.** VS Code added an import from `aws-globalaccelerator`, which would pull CDK into the Lambda bundle.
* **Run the handler locally first.** `tsx` plus a fake event tests the code against the real table, with no deploy.

## The shell

* **A shell variable lives in 1 terminal only.** `export TABLE=...` in 1 terminal does nothing in another. An empty `$TABLE` made a command fail.
* **A command in an editor tab does not run.** It must go in the terminal.

## JSON is strict

My first 2 files failed. Each mistake is common:

* Every key needs double quotes: `"BudgetName"`, not `BudgetName`.
* No comma after the last key in an object.
* Types matter. The budget `Amount` is a string (`"10"`), but the alert `Threshold` is a number (`50`).
* Some values are objects, not strings: `"BudgetLimit": { "Amount": "10", "Unit": "USD" }`.
* Enum values must match exactly: `PERCENTAGE`, not `PERCENTAGES`.
* A file that must be a list needs `[` and `]` around it.

Tip: run the file through `JSON.parse` before you give it to the CLI. The error shows the line and the column.

## CDK

* **`cdk init` needs an empty folder.** A leftover `package.json` from `npm init` blocks it.
* **`cdk init` also runs `npm install` and `git init`,** and makes the first commit.
* **Bootstrap once per account and region.** It makes the S3 bucket and IAM roles that every deploy uses.
* **CloudFront certificates must live in us-east-1,** even when the rest of the stack is in another region.
