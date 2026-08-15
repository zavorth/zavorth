import * as fs from 'fs';
import { resolve } from 'node:path';
import * as path from 'path';
import { VectorSemanticStore } from '../../src/storage/VectorSemanticStore';


describe('VectorSemanticStore', () => {
  const tempWorkspace = resolve(__dirname, 'temp-vector-workspace');

  beforeEach(() => {
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
    fs.mkdirSync(tempWorkspace, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  it('should throw on invalid workspace path in constructor', () => {
    expect(() => new VectorSemanticStore('')).toThrow('Invalid workspace path');
  });

  it('should skip files larger than 5MB', async () => {
    const store = new VectorSemanticStore(tempWorkspace);
    const largeFile = path.join(tempWorkspace, 'large.txt');
    
    // Create a 6MB file
    const stream = fs.createWriteStream(largeFile);
    for (let i = 0; i < 6 * 1024; i++) {
      stream.write('a'.repeat(1024));
    }
    stream.end();

    await new Promise(resolve => stream.on('finish', resolve));

    await store.indexFile(largeFile, 'large.txt');
    const results = store.query('aaaaa');
    expect(results.length).toBe(0);
  });

  it('should skip binary files', async () => {
    const store = new VectorSemanticStore(tempWorkspace);
    
    // Test by extension
    const imageFile = path.join(tempWorkspace, 'image.png');
    fs.writeFileSync(imageFile, 'Some fake content for png image file', 'utf8');
    await store.indexFile(imageFile, 'image.png');
    expect(store.query('content').length).toBe(0);

    // Test by null bytes content
    const exeFile = path.join(tempWorkspace, 'binary.dat');
    fs.writeFileSync(exeFile, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]));
    await store.indexFile(exeFile, 'binary.dat');
    expect(store.query('binary').length).toBe(0);
  });

  it('should index and query text with Unicode special characters (i18n)', async () => {
    const store = new VectorSemanticStore(tempWorkspace);
    
    const docFile = path.join(tempWorkspace, 'doc.txt');
    const content = `
      Olá! O coração de Zavorth bate forte com inteligência artificial.
      
      Esta é outra seção sobre o desenvolvimento de software local.
      
      A língua portuguesa é linda e cheia de caracteres especiais.
    `;
    fs.writeFileSync(docFile, content, 'utf8');

    await store.indexFile(docFile, 'doc.txt');

    // Query with special characters and accented characters
    const results1 = store.query('coração');
    expect(results1.length).toBeGreaterThan(0);
    expect(results1[0]).toContain('coração');

    const results2 = store.query('caracteres especiais');
    expect(results2.length).toBeGreaterThan(0);
    expect(results2[0]).toContain('língua portuguesa');
  });
});
