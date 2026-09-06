import type { CreativeBrief, GeneratedAsset } from "./types.js";

export interface ImageGenerator {
  readonly name: string;
  generateImage(brief: CreativeBrief): Promise<GeneratedAsset>;
}

export interface VideoGenerator {
  readonly name: string;
  generateVideo(brief: CreativeBrief, inputs: GeneratedAsset[]): Promise<GeneratedAsset>;
}

export interface Publisher {
  readonly name: string;
  publish(input: {
    creativeId: string;
    platform: string;
    asset: GeneratedAsset;
    caption?: string;
  }): Promise<{ externalId: string; url?: string }>;
}

export interface MetricsProvider {
  readonly name: string;
  fetchCreativeMetrics(externalId: string): Promise<Record<string, number>>;
}
