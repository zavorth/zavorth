import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ZAVORTH_CONTROL_PRODUCT_RULES,
  ZAVORTH_CONTROL_REQUIRED_CLASSES,
  ZAVORTH_CONTROL_TOKEN_NAMES,
} from '../../../src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/styles/zavorthControlVisualContract.js';

const cssPath = join(
  process.cwd(),
  'src/ai-gateway/app/(zavorthControl)/zavorthControl/zavorthControl/styles/zavorthControl.css',
);

describe('ZavorthControlVisualSystem', () => {
  it('keeps the ZavorthControl visual tokens from the prototype direction', () => {
    const css = readFileSync(cssPath, 'utf8');

    for (const token of ZAVORTH_CONTROL_TOKEN_NAMES) {
      expect(css).toContain(token);
    }
  });

  it('keeps the base classes required by the zavorthControl structure', () => {
    const css = readFileSync(cssPath, 'utf8');

    for (const className of ZAVORTH_CONTROL_REQUIRED_CLASSES) {
      expect(css).toContain(`.${className}`);
    }
  });

  it('documents the product rules that prevent hacker-theater UI regressions', () => {
    expect(ZAVORTH_CONTROL_PRODUCT_RULES).toEqual(expect.arrayContaining([
      'Pouco texto.',
      'Estado sempre visivel.',
      'Proxima acao obvia.',
      'Dados reais ou estado vazio honesto.',
      'Premium operacional, sem teatro hacker.',
    ]));
  });
});

