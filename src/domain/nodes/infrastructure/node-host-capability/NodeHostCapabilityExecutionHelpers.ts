import path from 'path';
import type { NodeHostExecutionResult } from './NodeHostCapabilityTypes.js';

export function normalizeTimeout(input: unknown, fallback: number): number {
  const parsed = Number(input || fallback) || fallback;
  return Math.max(1000, parsed);
}

export function inferImageMimeType(targetPath: string): string {
  const extension = path.extname(String(targetPath || '').trim()).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'image/png';
  }
}

export function buildExecutionResult(
  invocationId: string,
  result: Omit<NodeHostExecutionResult, 'invocationId'>,
): NodeHostExecutionResult {
  return {
    invocationId,
    ...result,
  };
}
