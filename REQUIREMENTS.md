# Requirements

Decided on 2026-10-27 and 2026-10-28. Open questions are at the end.

## Users

* **Editor:** the practice owner. She edits and publishes content. The CMS must not need technical skill.
* **Developer:** writes schemas and templates, and deploys the CMS.

## Functional requirements

### Schemas

* R1. Schemas live in `schemas/` and are written in TypeScript (TypeBox or Zod), so 1 file gives both the TS types and the JSON Schema.
* R2. The schema format is JSON Schema 2020-12, with `x-cms` and `x-ui` hints.
* R3. `x-cms.kind` is `singleton` (1 page) or `collection` (a page type with many entries).
* R4. Deploying a schema creates its page in the CMS.
* R5. Fields cover the basic HTML structures: text, rich text, images, links, lists and repeatable blocks.

### Content zones

* R6. Each page template declares its zone ids (for example `hero`, `main`, `aside`, `closing`).
* R7. Each field or block sets `"x-cms": { "zone": "main", "order": 2 }`. The schema author sets the zone, not the editor.
* R8. Each template exports its zone ids as a TS type. A build check fails on an unknown zone.

### Admin UI

* R9. A list of pages on the side. Click a page to edit its fields.
* R10. Drafts save even when they are not complete.
* R11. Strict validation runs only on publish.

### Publish

* R12. Before publish, an AI step drafts the SEO title and meta description. The editor can change them.
* R13. Fields marked hidden are removed from the published JSON.
* R14. After publish, the CMS calls the site's revalidate webhook, so the page updates without a full rebuild.

### Site integration

* R15. The site's `/admin` route sends a 302 redirect to `cms.uptherapygroup.com`.

### Login

* R16. The admin uses Clerk for login. Only invited users (the editor and the developer) can sign in.
* R17. Every admin route checks the Clerk token with an API Gateway JWT authorizer. A missing or bad token gets a 401, and the Lambda never runs. The public read route stays open.

## Non-functional requirements

* N1. **Cost:** a $10 monthly AWS budget with alerts at 50%, 80% and 100% of actual cost, plus a forecast alert. Cost Anomaly Detection alerts at $5 and 40%. (Done: see PROCESS.md, step 1.)
* N2. **Serverless first:** Lambda, DynamoDB and S3. No servers to patch.
* N3. **Least privilege:** each Lambda gets only the permissions it needs.
* N4. **Infrastructure as code:** every resource is in CDK. No hand-made resources in the console.
* N5. **CI/CD:** GitHub Actions deploys the stack.
* N6. **Public repo:** no account IDs, ARNs, emails or secrets in the code or the docs.
* N7. **Code style:** TypeScript everywhere. Always use braces on `if`, `else`, `for` and `while`.
* N8. **Tagging:** every resource has the tag `project=unleashed-cms`, for cost reports.

## Out of scope

* WordPress (headless or full): rejected for hosting and upkeep cost.
* Google Drive content sync: dropped.
* Google Cloud hosting.

## Open questions

* Can the editor ever move a block to a different zone?
* Does vinext on Cloudflare Workers support on-demand revalidation? (Not verified.)
* Clerk session tokens may have no `aud` claim, and the API Gateway JWT authorizer needs 1. A Clerk JWT template may fix this. (Not verified.)
