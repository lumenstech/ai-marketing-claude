import type { PerformanceMetrics } from '../types.js';

export interface MetaConfig {
  accessToken: string;
  graphBaseUrl: string;
}

export class MetaMetricsProvider {
  readonly name = 'meta';

  constructor(private readonly config: MetaConfig) {
    if (!/^https:\/\/graph\.facebook\.com\/v\d+\.\d+$/.test(config.graphBaseUrl)) {
      throw new Error('meta_graph_base_url_must_be_explicit_versioned_graph_url');
    }
  }

  async getAdMetrics(adId: string, since: string, until: string): Promise<PerformanceMetrics> {
    const url = new URL(`${this.config.graphBaseUrl}/${encodeURIComponent(adId)}/insights`);
    url.searchParams.set('fields', 'impressions,clicks,spend,actions,action_values,video_3_sec_watched_actions');
    url.searchParams.set('time_range', JSON.stringify({ since, until }));
    url.searchParams.set('access_token', this.config.accessToken);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`meta_insights_http_${response.status}`);
    const payload: any = await response.json();
    const row = payload?.data?.[0] ?? {};
    const action = (type: string) => Number((row.actions ?? []).find((x: any) => x.action_type === type)?.value ?? 0);
    const actionValue = (type: string) => Number((row.action_values ?? []).find((x: any) => x.action_type === type)?.value ?? 0);
    const video3s = Number((row.video_3_sec_watched_actions ?? [])[0]?.value ?? 0);

    return {
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: Number(row.spend ?? 0),
      conversions: action('purchase') || action('offsite_conversion.fb_pixel_purchase'),
      revenue: actionValue('purchase') || actionValue('offsite_conversion.fb_pixel_purchase'),
      videoViews3s: video3s
    };
  }
}
