import { readFileSync } from 'fs';
import { join } from 'path';
import {
  COMMAND_CENTER_PRODUCT_RULES,
  COMMAND_CENTER_REQUIRED_CLASSES,
  COMMAND_CENTER_TOKEN_NAMES,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/styles/commandCenterVisualContract.js';

const cssPath = join(
  process.cwd(),
  'src/ai-gateway/app/(dashboard)/control/command-center/styles/commandCenter.css',
);

describe('CommandCenterVisualSystem', () => {
  it('keeps the Command Center visual tokens from the prototype direction', () => {
    const css = readFileSync(cssPath, 'utf8');

    for (const token of COMMAND_CENTER_TOKEN_NAMES) {
      expect(css).toContain(token);
    }
  });

  it('keeps the base classes required by the dashboard structure', () => {
    const css = readFileSync(cssPath, 'utf8');

    for (const className of COMMAND_CENTER_REQUIRED_CLASSES) {
      expect(css).toContain(`.${className}`);
    }
  });

  it('documents the product rules that prevent hacker-theater UI regressions', () => {
    expect(COMMAND_CENTER_PRODUCT_RULES).toEqual(expect.arrayContaining([
      'Pouco texto.',
      'Estado sempre visivel.',
      'Proxima acao obvia.',
      'Dados reais ou estado vazio honesto.',
      'Premium operacional, sem teatro hacker.',
    ]));
  });
});

