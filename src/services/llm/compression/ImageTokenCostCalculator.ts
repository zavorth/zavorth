export type BillingType = 'patch' | 'tile' | 'area' | 'fixed';

export interface VisionBillingRule {
  type: BillingType;
  patchSize?: number;
  tileSize?: number;
  areaDivisor?: number;
  fixedTokens?: number;
  longEdgeMax?: number;
  tokenCap?: number;
  multiplier?: number;
  smallImageThreshold?: number;
}

export interface PageGeometry {
  cols: number;
  widthPx: number;
  heightPx: number;
  linesPerPage: number;
}

export interface ModelCapabilities {
  supportsImages: boolean;
  billing: VisionBillingRule;
  pageGeometry: PageGeometry;
}

const DEFAULT_BILLING: VisionBillingRule = {
  type: 'tile',
  tileSize: 512,
  fixedTokens: 85,
  multiplier: 170,
};

const DEFAULT_GEOMETRY: PageGeometry = {
  cols: 80,
  widthPx: 400,
  heightPx: 200,
  linesPerPage: 25,
};

/** Registry is intentionally empty — no model families are hardcoded.
 *  Providers register themselves via registerProvider(). Unknown models get
 *  conservative defaults (no image support) and the gate refuses compression. */
import { DynamicModelCatalogService } from '../../providers/catalog/DynamicModelCatalogService.js';

const BUILTIN_CAPABILITIES = new Map<string, ModelCapabilities>();

export class ModelCapabilityRegistry {
  registerProvider(name: string, capabilities: ModelCapabilities): void {
    BUILTIN_CAPABILITIES.set(name.toLowerCase(), capabilities);
  }

  getCapabilities(modelName: string, providerId?: string): ModelCapabilities {
    const model = (modelName ?? '').toLowerCase().trim();
    const direct = BUILTIN_CAPABILITIES.get(model);
    if (direct) {
      return direct;
    }

    const catalogDef = DynamicModelCatalogService.getModel(model, providerId);
    if (catalogDef?.supportsImageCompression) {
      if (catalogDef.providerId === 'google' || catalogDef.family === 'gemini') {
        return {
          supportsImages: true,
          billing: {
            type: 'fixed',
            fixedTokens: 258,
          },
          pageGeometry: {
            cols: 250,
            widthPx: 1024,
            heightPx: 768,
            linesPerPage: 80,
          },
        };
      }
      if (catalogDef.providerId === 'openai' || catalogDef.family === 'gpt') {
        return {
          supportsImages: true,
          billing: {
            type: 'tile',
            fixedTokens: 85,
            multiplier: 170,
            tileSize: 512,
          },
          pageGeometry: {
            cols: 250,
            widthPx: 1024,
            heightPx: 768,
            linesPerPage: 80,
          },
        };
      }

      // Default certified geometry for Anthropic / Claude
      return {
        supportsImages: true,
        billing: {
          type: 'patch',
          patchSize: 28,
          longEdgeMax: 1568,
          tokenCap: 1568,
        },
        pageGeometry: {
          cols: 312,
          widthPx: 1568,
          heightPx: 728,
          linesPerPage: 90,
        },
      };
    }

    return {
      supportsImages: false,
      billing: DEFAULT_BILLING,
      pageGeometry: DEFAULT_GEOMETRY,
    };
  }

  isImageSupported(modelName: string, providerId?: string): boolean {
    return this.getCapabilities(modelName, providerId).supportsImages;
  }
}

export const registry = new ModelCapabilityRegistry();

export function calculateImageTokens(width: number, height: number, rule: VisionBillingRule): number {
  if (rule.type === 'patch') {
    if (rule.longEdgeMax && rule.tokenCap) {
      const [outW, outH] = resizeToFitTier(width, height, rule.longEdgeMax, rule.tokenCap, rule.patchSize ?? 28);
      return Math.ceil(outW / (rule.patchSize ?? 28)) * Math.ceil(outH / (rule.patchSize ?? 28));
    }
    const patches = Math.ceil(width / (rule.patchSize ?? 28)) * Math.ceil(height / (rule.patchSize ?? 28));
    return patches * (rule.multiplier ?? 1);
  }

  if (rule.type === 'tile') {
    if (rule.smallImageThreshold && width <= rule.smallImageThreshold && height <= rule.smallImageThreshold) {
      return rule.fixedTokens ?? 258;
    }
    const unit = rule.tileSize ?? 512;
    const tilesW = Math.ceil(width / unit);
    const tilesH = Math.ceil(height / unit);
    return (rule.fixedTokens ?? 85) + tilesW * tilesH * (rule.multiplier ?? 170);
  }

  if (rule.type === 'area' && rule.areaDivisor) {
    return Math.ceil((width * height) / rule.areaDivisor);
  }

  if (rule.type === 'fixed' && rule.fixedTokens) {
    return rule.fixedTokens;
  }

  const tilesW = Math.ceil(width / (rule.tileSize ?? 512));
  const tilesH = Math.ceil(height / (rule.tileSize ?? 512));
  return (rule.fixedTokens ?? 85) + tilesW * tilesH * (rule.multiplier ?? 170);
}

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateImageTokens(width: number, height: number, modelName: string): number {
  const caps = registry.getCapabilities(modelName);
  return calculateImageTokens(width, height, caps.billing);
}

export interface CompressionDecision {
  compress: boolean;
  textTokens: number;
  imageTokens: number;
  savings: number;
  savingsRatio: number;
  charsPerPage: number;
  modelSupported: boolean;
}

export function shouldCompressToImage(
  text: string,
  modelName: string,
  minSavingsRatio = 0.5,
): CompressionDecision {
  const caps = registry.getCapabilities(modelName);

  if (!caps.supportsImages) {
    return {
      compress: false,
      textTokens: estimateTextTokens(text),
      imageTokens: 0,
      savings: 0,
      savingsRatio: 0,
      charsPerPage: 0,
      modelSupported: false,
    };
  }

  const textTokens = estimateTextTokens(text);
  const geo = caps.pageGeometry;
  const pages = Math.max(1, Math.ceil(text.length / (geo.cols * geo.linesPerPage * 5)));
  const pageTokens = calculateImageTokens(geo.widthPx, geo.heightPx, caps.billing);
  const imageTokens = pages * pageTokens;
  const savings = textTokens - imageTokens;
  const savingsRatio = textTokens > 0 ? savings / textTokens : 0;

  return {
    compress: savings > 0 && savingsRatio >= minSavingsRatio,
    textTokens,
    imageTokens,
    savings,
    savingsRatio,
    charsPerPage: geo.cols * geo.linesPerPage * 5,
    modelSupported: true,
  };
}

function resizeToFitTier(
  w: number,
  h: number,
  longEdgeMax: number,
  tokenCap: number,
  patch: number,
): [number, number] {
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const isLandscape = w >= h;

  if (long <= longEdgeMax && Math.ceil(long / patch) * Math.ceil(short / patch) <= tokenCap) {
    return [w, h];
  }

  let lo = patch;
  let hi = longEdgeMax;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    const candidateShort = Math.round((short * mid) / long);
    if (Math.ceil(mid / patch) * Math.ceil(candidateShort / patch) <= tokenCap) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  const outLong = lo;
  const outShort = Math.round((short * lo) / long);
  return isLandscape ? [outLong, outShort] : [outShort, outLong];
}
