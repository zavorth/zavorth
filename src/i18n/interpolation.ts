import type { InterpolationVars } from './types.js';

export function interpolate(template: string, vars: InterpolationVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const escaped = key.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{${escaped}\\}`, 'g'), String(value));
  }
  return result;
}
