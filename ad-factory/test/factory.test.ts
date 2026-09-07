import test from 'node:test';
import assert from 'node:assert/strict';
import { runFactory } from '../src/factory.js';

const product = {
  id:'product-1', brandId:'brand-1', name:'Demo Product', description:'demo',
  benefits:['save time'], painPoints:['slow setup'], objections:[]
};

test('factory persists every planned creative and queues generation jobs', async () => {
  const creatives:any[]=[]; const jobs:any[]=[];
  const repo = {
    async createCreative(input:any){const row={id:`creative-${creatives.length+1}`,...input};creatives.push(row);return row;},
    async createOrGetJob(input:any){const row={id:`job-${jobs.length+1}`,status:'queued',...input};jobs.push(row);return row;}
  };
  const result=await runFactory(repo,{product,brandSlug:'demo-brand',options:{platforms:['tiktok'],personas:['buyer'],variantsPerPersona:3}});
  assert.equal(result.planned,3);
  assert.equal(result.queued,3);
  assert.equal(creatives.length,3);
  assert.equal(jobs.length,3);
  assert.match(jobs[0].idempotencyKey,/source-image/);
});

test('factory can plan and persist without queueing media generation', async () => {
  let jobs=0;
  const repo={
    async createCreative(input:any){return {id:`creative-${Math.random()}`,...input};},
    async createOrGetJob(){jobs++;return {};}
  };
  const result=await runFactory(repo,{product,brandSlug:'demo',options:{platforms:['instagram'],variantsPerPersona:2},queueImageGeneration:false});
  assert.equal(result.planned,2);
  assert.equal(result.queued,0);
  assert.equal(jobs,0);
});
