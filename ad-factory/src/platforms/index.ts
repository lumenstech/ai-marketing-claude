import { MetaMetricsProvider } from './meta.js';
import { TikTokMetricsProvider } from './tiktok.js';

export interface PlatformEnv {
  META_ACCESS_TOKEN?: string;
  META_GRAPH_BASE_URL?: string;
  TIKTOK_ACCESS_TOKEN?: string;
  TIKTOK_ADVERTISER_ID?: string;
  TIKTOK_API_BASE_URL?: string;
}

export function createMetricsProvider(platform: string, env: PlatformEnv) {
  if (platform === 'meta' || platform === 'facebook' || platform === 'instagram') {
    if (!env.META_ACCESS_TOKEN || !env.META_GRAPH_BASE_URL) throw new Error('meta_not_configured');
    return new MetaMetricsProvider({ accessToken: env.META_ACCESS_TOKEN, graphBaseUrl: env.META_GRAPH_BASE_URL });
  }
  if (platform === 'tiktok') {
    if (!env.TIKTOK_ACCESS_TOKEN || !env.TIKTOK_ADVERTISER_ID) throw new Error('tiktok_not_configured');
    return new TikTokMetricsProvider({ accessToken: env.TIKTOK_ACCESS_TOKEN, advertiserId: env.TIKTOK_ADVERTISER_ID, baseUrl: env.TIKTOK_API_BASE_URL });
  }
  throw new Error(`unsupported_metrics_platform_${platform}`);
}
