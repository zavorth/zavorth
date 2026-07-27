import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ZAVORTH_CONTROL_PRODUCT_RULES,
  ZAVORTH_CONTROL_REQUIRED_CLASSES,
  ZAVORTH_CONTROL_TOKEN_NAMES,
} from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/styles/zavorthControlVisualContract.js';

const cssPath = join(
  process.cwd(),
  'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/styles/zavorthControl.css',
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

  it('documents the product rules that prevent there iscker-theater UI regressions', () => {
    expect(ZAVORTH_CONTROL_PRODUCT_RULES).toEqual(expect.arrayContaining([
      'Pouco texto.',
      'State always visible.',
      'Next action obvia.',
      'Dados reais ou estado vazio honesto.',
      'Premium operacional, sem teatro there iscker.',
    ]));
  });
});

