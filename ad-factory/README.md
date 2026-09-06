# Ad Factory Core

Provider-neutral creative production and testing infrastructure for short-form advertising.

## Architecture

- Existing `/market ads` skill: upstream business analysis, hooks, personas, scripts, objections and campaign angles.
- Neon: canonical system of record for brands, products, creatives, experiments, publications, metrics and winner scores.
- Cloudflare R2: intended durable asset storage for generated media.
- n8n: orchestration only. It must not become the source of truth.
- Nano Banana: image/source-frame generation adapter.
- Linah: video provider behind a transport interface. Official endpoint/schema must be supplied before activation.
- Future video/image providers implement the same interfaces without changing core creative records.

## Current state

Implemented in this module:

1. Core TypeScript domain types.
2. ImageGenerator, VideoGenerator, Publisher and MetricsProvider interfaces.
3. Nano Banana adapter using `@google/genai`.
4. Linah adapter boundary that fails closed until official API details are configured.
5. Neon SQL migration for brands, products, assets, creatives, publications, metric snapshots, experiments and creative scores.
6. Winner scoring engine with a minimum-data mutation gate.
7. Importable n8n workflow skeleton for request -> brief -> generation -> response.
8. Unit tests for winner mutation gating.

## Safety / deployment boundaries

This branch does not:

- modify any production Neon database;
- add or expose provider secrets;
- publish any live ads;
- invent undocumented Linah endpoints;
- activate the n8n workflow.

Those require deployment credentials and verified provider contracts.

## Activation variables

Do not commit values. Runtime configuration may use:

- `DATABASE_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `GEMINI_API_KEY`
- `NANO_BANANA_MODEL`
- `AD_FACTORY_CORE_URL`
- `AD_FACTORY_CORE_TOKEN`
- Linah credentials/endpoint names matching its official documentation
- Meta/TikTok publishing and metrics credentials when publishing adapters are enabled

## Recommended rollout

1. Apply `sql/001_ad_factory_core.sql` to a non-production Neon branch.
2. Run `npm install && npm run typecheck && npm test` in this directory.
3. Implement the HTTP service around the provider interfaces.
4. Connect R2 persistence.
5. Import `workflows/ad-factory-core.n8n.json` and keep inactive until endpoint authentication is configured.
6. Add official Linah transport after API documentation/credentials are available.
7. Add publishing adapters in approval mode first.
8. Enable winner mutation only after platform metric ingestion is verified.
