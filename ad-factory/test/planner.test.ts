import assert from 'node:assert/strict';
import test from 'node:test';
import { planCreatives } from '../src/planner.js';
import type { ProductInput } from '../src/types.js';

const product: ProductInput = {
  id:'product-1', brandId:'brand-1', name:'Example Product', description:'A useful product',
  benefits:['save time'], painPoints:['slow manual work'], objections:['setup time'],
  sourceUrls:[], imageUrls:[]
};

test('planner creates platform and persona variants without provider credentials',()=>{
  const briefs=planCreatives(product,{platforms:['tiktok','instagram'],personas:['homeowner','contractor'],variantsPerPersona:3});
  assert.equal(briefs.length,12);
  assert.equal(briefs.filter(b=>b.platform==='tiktok').length,6);
  assert.equal(briefs.filter(b=>b.persona==='contractor').length,6);
  for(const brief of briefs){assert.ok(brief.hook);assert.ok(brief.script.includes('HOOK:'));assert.ok(brief.visualInstructions.length>=4)}
});

test('planner caps variant explosion',()=>{
  const briefs=planCreatives(product,{platforms:['tiktok'],personas:['buyer'],variantsPerPersona:99});
  assert.equal(briefs.length,10);
});
