import { readFileSync } from 'fs';
import {join, resolve} from 'path';


const root = resolve(__dirname, '../../');

describe('Zavorth CLI database key rotation command', () => {
  it('exposes the rotate-db-key command and /ops/rotate-db-key command in the CLI', () => {
    const source = readFileSync(join(root, 'src/zavorth-cli.ts'), 'utf8');

    expect(source).toContain("'rotate-db-key'");
    expect(source).toContain("'/ops/rotate-db-key'");
    expect(source).toContain("db.rotateKey(");
    expect(source).toContain("Database Key Rotation");
  });
});
