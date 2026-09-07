import { createRepository } from './db.js';
import { scoreCreative } from './scoring.js';

interface Env {
  DATABASE_URL: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function body<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const repo = createRepository(env.DATABASE_URL);

    if (request.method === 'GET' && url.pathname === '/health') {
      const ok = await repo.health();
      return json({ ok, service: 'ad-factory-core' }, ok ? 200 : 503);
    }

    if (request.method === 'POST' && url.pathname === '/v1/brands') {
      return json(await repo.upsertBrand(await body(request)), 201);
    }

    if (request.method === 'POST' && url.pathname === '/v1/products') {
      return json(await repo.upsertProduct(await body(request)), 201);
    }

    if (request.method === 'POST' && url.pathname === '/v1/creatives') {
      return json(await repo.createCreative(await body(request)), 201);
    }

    if (request.method === 'POST' && url.pathname === '/v1/assets') {
      return json(await repo.attachAsset(await body(request)), 201);
    }

    if (request.method === 'POST' && url.pathname === '/v1/score') {
      const input = await body<{ creativeId: string; metrics: Parameters<typeof scoreCreative>[0] }>(request);
      const result = scoreCreative(input.metrics);
      return json(await repo.recordScore({ creativeId: input.creativeId, ...result }), 201);
    }

    return json({ error: 'not_found' }, 404);
  }
};
