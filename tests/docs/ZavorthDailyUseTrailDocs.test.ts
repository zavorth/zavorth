import { existsSync, readFileSync } from 'fs';
import {join, resolve} from 'path';


const root = resolve(__dirname, '../../');

describe('Zavorth daily use trail documentation', () => {
  it('documents the user-facing setup and daily loop without heavy internal language', () => {
    const docPath = join(root, 'docs/daily-use-trail.md');
    expect(existsSync(docPath)).toBe(true);

    const doc = readFileSync(docPath, 'utf8');
    for (const phrase of [
      'Choose experience profile',
      'Connect a provider',
      'Connect a channel',
      'Pick a runtime profile',
      'Review learned memory',
      'Add tools and skills',
      'Schedule a routine',
      'Run quality checks',
      'Daily product experience',
      'npm run zavorth:daily-product-experience',
      'Review clear previews',
    ]) {
      expect(doc).toContain(phrase);
    }

    expect(doc).not.toMatch(/transaction plane|policy broker|quarantine|external agent/i);
  });
});
