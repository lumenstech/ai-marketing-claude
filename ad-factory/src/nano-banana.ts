import { GoogleGenAI } from '@google/genai';
import type { CreativeBrief, GeneratedAsset } from './types.js';
import type { ImageGenerator } from './providers.js';

export class NanoBananaProvider implements ImageGenerator {
  readonly name = 'google-nano-banana';
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    if (!options.apiKey) throw new Error('GEMINI_API_KEY is required to activate Nano Banana');
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'gemini-3.1-flash-image';
  }

  async generateImage(brief: CreativeBrief): Promise<GeneratedAsset> {
    const prompt = [
      `Create a photorealistic advertising source image for ${brief.product.name}.`,
      `Persona: ${brief.persona}.`,
      `Hook: ${brief.hook}.`,
      `Angle: ${brief.angle}.`,
      `Platform: ${brief.platform}.`,
      `Visual instructions: ${brief.visualInstructions.join('; ')}.`,
      'Keep product identity consistent, avoid unsupported claims, and leave safe text-overlay space.'
    ].join('\n');

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'] }
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) throw new Error('Nano Banana returned no image data');

    return {
      provider: this.name,
      kind: 'image',
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
      bytesBase64: imagePart.inlineData.data,
      metadata: { model: this.model }
    };
  }
}
