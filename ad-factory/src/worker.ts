import { createRepository } from './db.js';
import { createExperimentStore } from './experiment-store.js';
import { evaluateExperiment, type EvaluationRules } from './evaluation.js';
import { runFactory, type FactoryRunInput } from './factory.js';
import { processImageJobs } from './job-processor.js';
import { createCreativeLibrary } from './library.js';
import { NanoBananaProvider } from './nano-banana.js';
import { planMutations } from './mutation.js';
import { planCreatives, type PlanOptions } from './planner.js';
import { scoreCreative } from './scoring.js';
import { persistGeneratedAsset, type ObjectBucket } from './storage.js';
import type { CreativeBrief, PerformanceMetrics, ProductInput } from './types.js';

interface Env { DATABASE_URL:string; AD_FACTORY_TOKEN?:string; GEMINI_API_KEY?:string; NANO_BANANA_MODEL?:string; ASSETS?:ObjectBucket; }
interface ExecutionContext { waitUntil(promise:Promise<unknown>):void; }
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}})}
async function body<T>(request:Request):Promise<T>{return request.json() as Promise<T>}
function authorized(request:Request,env:Env){if(!env.AD_FACTORY_TOKEN)return false;return request.headers.get('authorization')===`Bearer ${env.AD_FACTORY_TOKEN}`}

const worker = {
async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url); const repo=createRepository(env.DATABASE_URL); const experiments=createExperimentStore(env.DATABASE_URL); const library=createCreativeLibrary(env.DATABASE_URL);
  if(request.method==='GET'&&url.pathname==='/health'){const ok=await repo.health();return json({ok,service:'ad-factory-core',capabilities:{database:ok,auth:Boolean(env.AD_FACTORY_TOKEN),creativePlanner:true,factoryRun:true,automaticGeneration:true,creativeLibrary:true,imageGeneration:Boolean(env.GEMINI_API_KEY),assetStorage:Boolean(env.ASSETS),mutationProcessor:true,experimentEvaluator:true}},ok?200:503)}
  if(!authorized(request,env))return json({error:'unauthorized'},401);
  if(request.method==='POST'&&url.pathname==='/v1/plan'){const input=await body<{product:ProductInput;options?:PlanOptions}>(request);if(!input.product?.id||!input.product?.brandId||!input.product?.name)return json({error:'invalid_product'},400);const briefs=planCreatives(input.product,input.options);return json({count:briefs.length,briefs},200)}
  if(request.method==='POST'&&url.pathname==='/v1/factory/run'){const input=await body<FactoryRunInput>(request);if(!input.product?.id||!input.product?.brandId||!input.product?.name||!input.brandSlug)return json({error:'invalid_factory_input'},400);return json(await runFactory(repo,input),201)}
  if(request.method==='POST'&&url.pathname==='/v1/jobs/process'){const input=await body<{limit?:number}>(request);return json(await processImageJobs(env,input.limit??5),200)}
  if(request.method==='GET'&&url.pathname==='/v1/library'){return json(await library.list({brandId:url.searchParams.get('brandId')??undefined,productId:url.searchParams.get('productId')??undefined,status:url.searchParams.get('status')??undefined,limit:Number(url.searchParams.get('limit')??50)}),200)}
  if(request.method==='GET'&&url.pathname.startsWith('/v1/library/')){const creativeId=url.pathname.slice('/v1/library/'.length);const item=await library.get(creativeId);return item?json(item,200):json({error:'creative_not_found'},404)}
  if(request.method==='POST'&&url.pathname==='/v1/brands')return json(await repo.upsertBrand(await body(request)),201);
  if(request.method==='POST'&&url.pathname==='/v1/products')return json(await repo.upsertProduct(await body(request)),201);
  if(request.method==='POST'&&url.pathname==='/v1/creatives')return json(await repo.createCreative(await body(request)),201);
  if(request.method==='POST'&&url.pathname==='/v1/assets')return json(await repo.attachAsset(await body(request)),201);
  if(request.method==='POST'&&url.pathname==='/v1/jobs'){const input=await body<{idempotencyKey:string;kind:string;creativeId?:string;payload?:unknown}>(request);return json(await repo.createOrGetJob(input),201)}
  if(request.method==='POST'&&url.pathname==='/v1/metrics'){const input=await body<{publicationId:string;metrics:PerformanceMetrics;raw?:unknown}>(request);return json(await repo.recordMetricSnapshot(input),201)}
  if(request.method==='POST'&&url.pathname==='/v1/generate/image'){
    if(!env.GEMINI_API_KEY)return json({error:'nano_banana_not_configured'},503); if(!env.ASSETS)return json({error:'asset_storage_not_configured'},503);
    const input=await body<{brandId:string;brandSlug:string;productId:string;creativeId:string;brief:CreativeBrief;idempotencyKey?:string}>(request);const job=input.idempotencyKey?await repo.createOrGetJob({idempotencyKey:input.idempotencyKey,kind:'generate-image',creativeId:input.creativeId,payload:input}):null;if(job&&job.status==='completed')return json(job,200);
    try{const provider=new NanoBananaProvider({apiKey:env.GEMINI_API_KEY,model:env.NANO_BANANA_MODEL});const generated=await provider.generateImage(input.brief);const stored=await persistGeneratedAsset(env.ASSETS,{brandSlug:input.brandSlug,creativeId:input.creativeId,asset:generated});const asset=await repo.attachAsset({brandId:input.brandId,productId:input.productId,creativeId:input.creativeId,kind:'image',role:'source-image',provider:generated.provider,providerAssetId:generated.providerAssetId,storageKey:stored.storageKey,mimeType:generated.mimeType,metadata:{...generated.metadata,byteLength:stored.byteLength}});if(job)await repo.completeJob({id:job.id,result:{assetId:asset.id}});return json({asset,generated:{provider:generated.provider,mimeType:generated.mimeType}},201)}catch(error){if(job)await repo.completeJob({id:job.id,error:error instanceof Error?error.message:'generation_failed'});throw error}
  }
  if(request.method==='POST'&&url.pathname==='/v1/score'){const input=await body<{creativeId:string;metrics:PerformanceMetrics;generation?:number}>(request);const result=scoreCreative(input.creativeId,input.metrics);const saved=await repo.recordScore(result);let mutation=null;if(result.mutate)mutation=await repo.enqueueMutation({creativeId:input.creativeId,reason:result.reasons.join('; '),generation:(input.generation??0)+1});return json({score:saved,mutation},201)}
  if(request.method==='POST'&&url.pathname==='/v1/mutations/process-next'){const queued=await repo.claimNextMutation();if(!queued)return json({processed:false,reason:'queue_empty'},200);try{const parent=await repo.getCreative(queued.creative_id);if(!parent)throw new Error('parent_creative_not_found');const planned=planMutations(parent.brief as CreativeBrief);const variants=[];for(const mutation of planned)variants.push(await repo.createMutationExperiment({queueId:queued.id,parentCreative:parent,generation:queued.generation,mutation}));await repo.completeMutation({queueId:queued.id});return json({processed:true,queueId:queued.id,parentCreativeId:parent.id,generation:queued.generation,variants},201)}catch(error){const message=error instanceof Error?error.message:'mutation_processing_failed';await repo.completeMutation({queueId:queued.id,error:message});return json({processed:false,queueId:queued.id,error:message},500)}}
  if(request.method==='POST'&&url.pathname==='/v1/experiments/evaluate'){const input=await body<{experimentId:string;rules?:EvaluationRules}>(request);const experiment=await experiments.getExperiment(input.experimentId);if(!experiment)return json({error:'experiment_not_found'},404);const control=await experiments.getVariantMetrics(input.experimentId,'control');const challenger=await experiments.getVariantMetrics(input.experimentId,'challenger');if(!control||!challenger)return json({error:'experiment_variants_missing'},409);const evaluation=evaluateExperiment(control.metrics,challenger.metrics,input.rules??{});const saved=await experiments.saveEvaluation(input.experimentId,evaluation,control.metrics,challenger.metrics);await experiments.applyOutcome({experimentId:input.experimentId,outcome:evaluation.outcome,controlCreativeId:control.creativeId,challengerCreativeId:challenger.creativeId});return json({evaluation:saved,control,challenger},200)}
  return json({error:'not_found'},404);
},
async scheduled(_controller:unknown,env:Env,ctx:ExecutionContext){ctx.waitUntil(processImageJobs(env,5));}
};
export default worker;
