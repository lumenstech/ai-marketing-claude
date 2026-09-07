# Ad Factory Core

Owned creative-production infrastructure for short-form advertising.

## Primary flow

`Product -> planner -> persisted creative variants -> generation jobs -> Nano Banana -> R2 -> Neon creative library`

Meta, TikTok, OAuth and paid publishing are not dependencies of the production path. Distribution and performance measurement are optional downstream adapters.

## Architecture

- Existing `/market ads` skill: upstream marketing analysis and campaign intelligence.
- Neon: canonical source of truth for products, creatives, jobs, assets, experiments and metrics.
- Cloudflare Worker: API plus scheduled job processor.
- Cloudflare R2: generated asset storage.
- Nano Banana: source-image and first-frame generation.
- Video providers: interchangeable adapters; Linah remains disabled until a verified contract/API is available.
- n8n: optional orchestration, never the system of record.

## Implemented

- Credential-free product-to-creative planner.
- `POST /v1/factory/run` batch planning/persistence/job creation.
- Creative library endpoints.
- Claim-safe generation jobs with five-minute leases and bounded retries.
- Scheduled Worker processor every five minutes.
- Nano Banana generation and R2 persistence.
- Creative/asset linkage in Neon.
- Winner scoring, controlled mutation and experiment evaluation infrastructure.
- Development migrations `001` through `006`.

## Runtime configuration

Values are never committed. The Worker uses its R2 binding directly, so separate R2 access-key variables are not required.

Required for the full generation path:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `AD_FACTORY_TOKEN`

Optional:

- `NANO_BANANA_MODEL` (defaults to `gemini-3.1-flash-image`)

Normal operation does not require Meta/TikTok credentials.

## Cloudflare deployment

From `ad-factory/` on an already authenticated machine:

```sh
npm install
npm run typecheck
npm test
npm run cf:bootstrap
```

`cf:bootstrap` is deliberately non-interactive. It:

1. verifies the machine is already authenticated with Wrangler;
2. creates the production/development R2 buckets if missing;
3. copies `DATABASE_URL`, `GEMINI_API_KEY` and `AD_FACTORY_TOKEN` from existing shell environment variables only when they are already present;
4. runs a Wrangler dry-run;
5. deploys the Worker.

It never prints secret values and does not ask the operator to type credentials into the script.

## Safety boundaries

- No live ad publishing or spend is enabled.
- Synthetic testimonials and unsupported product claims are prohibited by the creative/mutation design.
- Linah calls remain disabled until its official API and output-rights terms are verified.
- Provider secrets stay outside Git.
