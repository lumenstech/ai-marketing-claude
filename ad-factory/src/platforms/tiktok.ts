import type { PerformanceMetrics } from '../types.js';

export interface TikTokConfig {
  accessToken: string;
  advertiserId: string;
  baseUrl?: string;
}

export class TikTokMetricsProvider {
  readonly name = 'tiktok';
  private readonly baseUrl: string;

  constructor(private readonly config: TikTokConfig) {
    this.baseUrl = config.baseUrl ?? 'https://business-api.tiktok.com/open_api/v1.3';
  }

  async getAdMetrics(adId: string, startDate: string, endDate: string): Promise<PerformanceMetrics> {
    const url = new URL(`${this.baseUrl}/report/integrated/get/`);
    url.searchParams.set('advertiser_id', this.config.advertiserId);
    url.searchParams.set('report_type', 'BASIC');
    url.searchParams.set('data_level', 'AUCTION_AD');
    url.searchParams.set('dimensions', JSON.stringify(['ad_id']));
    url.searchParams.set('metrics', JSON.stringify(['spend','impressions','clicks','conversion','total_complete_payment_rate','video_play_actions','video_watched_2s','video_watched_6s']));
    url.searchParams.set('filters', JSON.stringify([{ field_name: 'ad_ids', filter_type: 'IN', filter_value: JSON.stringify([adId]) }]));
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);

    const response = await fetch(url, {
      headers: { 'Access-Token': this.config.accessToken }
    });
    if (!response.ok) throw new Error(`tiktok_report_http_${response.status}`);
    const payload: any = await response.json();
    if (payload?.code !== 0) throw new Error(`tiktok_report_error_${payload?.code ?? 'unknown'}`);
    const metrics = payload?.data?.list?.[0]?.metrics ?? {};

    return {
      impressions: Number(metrics.impressions ?? 0),
      clicks: Number(metrics.clicks ?? 0),
      spend: Number(metrics.spend ?? 0),
      conversions: Number(metrics.conversion ?? 0),
      videoViews3s: Number(metrics.video_watched_2s ?? 0)
    };
  }
}
