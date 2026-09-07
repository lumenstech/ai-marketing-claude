export type Platform = "tiktok" | "instagram" | "facebook" | "youtube" | "other";
export type AssetKind = "image" | "video" | "audio" | "thumbnail" | "caption";
export type CreativeStatus = "draft" | "generated" | "qa_failed" | "approved" | "published" | "retired";

export interface ProductInput {
  id: string;
  brandId: string;
  name: string;
  description: string;
  benefits: string[];
  painPoints: string[];
  objections: string[];
  offer?: string;
  sourceUrls?: string[];
  imageUrls?: string[];
}

export interface CreativeBrief {
  product: ProductInput;
  persona: string;
  hook: string;
  angle: string;
  platform: Platform;
  durationSeconds: number;
  cta: string;
  script: string;
  visualInstructions: string[];
}

export interface GeneratedAsset {
  provider: string;
  providerAssetId?: string;
  kind: AssetKind;
  mimeType: string;
  uri?: string;
  bytesBase64?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  impressions?: number;
  clicks?: number;
  spend?: number;
  conversions?: number;
  revenue?: number;
  videoViews3s?: number;
  videoViews25Pct?: number;
  videoViews50Pct?: number;
  videoViews75Pct?: number;
  videoViews95Pct?: number;
}

export interface CreativeScore {
  creativeId: string;
  score: number;
  reasons: string[];
  mutate: boolean;
}
