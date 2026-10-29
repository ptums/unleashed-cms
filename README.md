# unleashed-cms

A small, schema-based CMS for the Up Therapy Group website. It is written in TypeScript and runs serverless on AWS.

The website itself stays on Cloudflare Workers. The site's `/admin` route sends a 302 redirect to the CMS admin at `cms.uptherapygroup.com`.

## How it works

1. A developer writes a schema in `schemas/`. Each schema defines 1 page (a singleton) or 1 page type (a collection).
2. Deploying the schema creates the page in the CMS.
3. The editor opens the admin, picks a page from the list, edits its fields and clicks Publish.
4. On publish, the CMS validates the page, drafts the SEO fields with a small AI model, saves the published JSON, then calls the site's revalidate webhook.

## Stack

| Part | Service |
|------|---------|
| Infrastructure as code | AWS CDK (TypeScript) |
| API | AWS Lambda (Node.js, TypeScript) |
| Content | Amazon DynamoDB |
| Images | Amazon S3 |
| Admin UI host | S3 + CloudFront |
| SEO drafts | Claude (a small Haiku-class model) |
| Region | us-east-2 (the CloudFront certificate lives in us-east-1, as AWS requires) |

## Layout

```
bin/        CDK app entry point
lib/        CDK stacks (the AWS resources)
test/       Jest tests
schemas/    Page schemas (planned)
```

## Commands

* `npm run build`: type-check the project
* `npm run test`: run the Jest tests
* `npx cdk synth`: print the CloudFormation template
* `npx cdk diff`: compare the code with what is deployed
* `npx cdk deploy`: deploy the stack

## Status

Work in progress. See [PROCESS.md](PROCESS.md) for each step so far.

## Docs

* [REQUIREMENTS.md](REQUIREMENTS.md): what the CMS must do
* [PROCESS.md](PROCESS.md): how it was built, step by step
* [LEARNING.md](LEARNING.md): what I learned along the way

## Safety notes

This repo is public. Account IDs, ARNs, emails and secrets never go in it. Local-only config (for example, the budget alert files) lives outside the repo.
