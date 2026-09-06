import type { CreativeBrief, GeneratedAsset } from "./types.js";
import type { VideoGenerator } from "./providers.js";

export interface LinahTransport {
  generate(input: {
    brief: CreativeBrief;
    sourceAssets: GeneratedAsset[];
  }): Promise<{
    id: string;
    uri?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export class LinahProvider implements VideoGenerator {
  readonly name = "linah";
  constructor(private readonly transport: LinahTransport) {}

  async generateVideo(brief: CreativeBrief, inputs: GeneratedAsset[]): Promise<GeneratedAsset> {
    const result = await this.transport.generate({ brief, sourceAssets: inputs });
    return {
      provider: this.name,
      providerAssetId: result.id,
      kind: "video",
      mimeType: result.mimeType ?? "video/mp4",
      uri: result.uri,
      metadata: result.metadata
    };
  }
}

export class UnconfiguredLinahTransport implements LinahTransport {
  async generate(): Promise<never> {
    throw new Error(
      "Linah transport is not configured. Supply the official Linah API endpoint/schema and credentials; do not guess undocumented endpoints."
    );
  }
}
