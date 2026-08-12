export interface SignatureCacheStats {
  size: number;
  hits: number;
  misses: number;
}

const signatureCache = new Map<string, { response: unknown; expiresAt: number }>();
let sigHits = 0;
let sigMisses = 0;

export function getSignedResponse(signature: string): unknown | undefined {
  const entry = signatureCache.get(signature);
  if (!entry) {
    sigMisses++;
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    signatureCache.delete(signature);
    sigMisses++;
    return undefined;
  }
  sigHits++;
  return entry.response;
}

export function setSignedResponse(signature: string, response: unknown, ttlMs: number): void {
  signatureCache.set(signature, { response, expiresAt: Date.now() + ttlMs });
}

export function getCacheStats(): SignatureCacheStats {
  return {
    size: signatureCache.size,
    hits: sigHits,
    misses: sigMisses,
  };
}
