# unleashed-cms

A small headless CMS for the Up Therapy Group website. It is TypeScript, and it runs serverless on AWS.

* **Admin:** https://cms.uptherapygroup.com (sign-in is by invite only)
* **Website:** stays on Cloudflare Workers. It reads the published pages from this CMS's public API.

## How it works

1. A developer writes a schema for each page in `schema/`.
2. `npm run sync` saves the schemas and makes an empty draft for each new page.
3. The editor signs in, picks a page, edits it and clicks **Publish**.
4. Publish checks the page, then the AI writes the SEO title, the meta description and the image alt text.
5. The website gets the published page from `GET /pages/{id}`.

The AI makes new SEO only on the first publish, or when more than 300 characters of text change. A failed AI step never stops a publish.

## Stack

| Part | Service |
|------|---------|
| Infrastructure | AWS CDK (TypeScript), region us-east-2 |
| API | API Gateway (HTTP API) + Lambda (Node.js) |
| Content and schemas | DynamoDB |
| Images | S3 (direct upload with signed URLs) |
| Admin UI | React + Vite + RJSF, hosted on S3 + CloudFront |
| Sign-in | Clerk (JWT checked by API Gateway) |
| AI (SEO and alt text) | Amazon Bedrock, Nova Lite |

## Folders

```
admin/     The admin UI (React)
bin/       CDK app entry point
lib/       The CDK stack (all AWS resources)
lambda/    1 file per API route; lambda/ai/ has the AI steps
schema/    Page schemas (Zod), 1 file per page or collection
json/      JSON Schema sources for npm run json-to-zod
scripts/   Local dev server, schema sync, JSON-to-Zod
test/      Jest tests
```

## Run it on your machine

1. `npm install` and `npm --prefix admin install`
2. Start the API: `TABLE_NAME=... SCHEMA_TABLE_NAME=... MEDIA_BUCKET_NAME=... AWS_REGION=us-east-2 npm run dev` (the names come from the `cdk deploy` outputs)
3. Start the admin: `npm --prefix admin run dev`, then open http://localhost:5173

The admin needs `VITE_CLERK_PUBLISHABLE_KEY` in `admin/.env.local`.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run deploy` | Build the admin UI and deploy everything |
| `npm run sync` | Save the schemas to AWS |
| `npm run json-to-zod` | Make Zod schemas from `json/` |
| `npm run build` | Type-check |
| `npm test` | Run the Jest tests |
| `npx cdk diff` | Show what a deploy would change |

## Docs

* [REQUIREMENTS.md](REQUIREMENTS.md): what the CMS must do
* [PROCESS.md](PROCESS.md): how it was built, step by step
* [LEARNING.md](LEARNING.md): what I learned along the way

## Safety notes

This repo is public. Account IDs, ARNs, emails and secrets never go in it. Local-only config (for example, the budget alert files) lives outside the repo.
