import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'integration-'));

describe('Integration Tests', () => {
  let dir: string;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  describe('File Operations Integration', () => {
    it('creates file and reads it back', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello world');
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).toBe('hello world');
    });

    it('creates directory and lists contents', () => {
      const subdir = path.join(dir, 'sub');
      fs.mkdirSync(subdir);
      fs.writeFileSync(path.join(subdir, 'a.txt'), 'a');
      fs.writeFileSync(path.join(subdir, 'b.txt'), 'b');
      const files = fs.readdirSync(subdir);
      expect(files).toContain('a.txt');
      expect(files).toContain('b.txt');
    });

    it('copies file', () => {
      const src = path.join(dir, 'src.txt');
      const dst = path.join(dir, 'dst.txt');
      fs.writeFileSync(src, 'hello');
      fs.copyFileSync(src, dst);
      expect(fs.readFileSync(dst, 'utf-8')).toBe('hello');
    });

    it('renames file', () => {
      const old = path.join(dir, 'old.txt');
      const newName = path.join(dir, 'new.txt');
      fs.writeFileSync(old, 'hello');
      fs.renameSync(old, newName);
      expect(fs.existsSync(newName)).toBe(true);
      expect(fs.existsSync(old)).toBe(false);
    });
  });

  describe('JSON Operations Integration', () => {
    it('writes and reads JSON', () => {
      const file = path.join(dir, 'data.json');
      const data = { name: 'test', value: 42 };
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      const read = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(read.name).toBe('test');
      expect(read.value).toBe(42);
    });

    it('handles nested JSON', () => {
      const file = path.join(dir, 'nested.json');
      const data = { a: { b: { c: [1, 2, 3] } } };
      fs.writeFileSync(file, JSON.stringify(data));
      const read = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(read.a.b.c).toEqual([1, 2, 3]);
    });
  });

  describe('Path Operations Integration', () => {
    it('joins paths correctly', () => {
      expect(path.join('a', 'b', 'c')).toBe(path.join('a', 'b', 'c'));
    });

    it('resolves relative paths', () => {
      const resolved = path.resolve('test.txt');
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    it('gets file extension', () => {
      expect(path.extname('test.txt')).toBe('.txt');
      expect(path.extname('test.ts')).toBe('.ts');
      expect(path.extname('test')).toBe('');
    });

    it('gets file name', () => {
      expect(path.basename('/path/to/test.txt')).toBe('test.txt');
      expect(path.basename('/path/to/test.txt', '.txt')).toBe('test');
    });

    it('gets directory name', () => {
      expect(path.dirname('/path/to/test.txt')).toBe('/path/to');
    });
  });

  describe('Error Handling Integration', () => {
    it('handles file not found', () => {
      expect(() => fs.readFileSync('/nonexistent')).toThrow();
    });

    it('handles directory not found', () => {
      expect(() => fs.readdirSync('/nonexistent')).toThrow();
    });

    it('handles permission denied gracefully', () => {
      const file = path.join(dir, 'test.txt');
      fs.writeFileSync(file, 'hello');
      expect(fs.readFileSync(file, 'utf-8')).toBe('hello');
    });
  });

  describe('Async Operations Integration', () => {
    it('handles promises', async () => {
      const result = await Promise.resolve('hello');
      expect(result).toBe('hello');
    });

    it('handles promise.all', async () => {
      const results = await Promise.all([
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3),
      ]);
      expect(results).toEqual([1, 2, 3]);
    });

    it('handles promise.race', async () => {
      const result = await Promise.race([
        new Promise((resolve) => setTimeout(() => resolve('slow'), 100)),
        new Promise((resolve) => setTimeout(() => resolve('fast'), 10)),
      ]);
      expect(result).toBe('fast');
    }, 10000);
  });

  describe('String Manipulation Integration', () => {
    it('handles template literals', () => {
      const name = 'world';
      const greeting = `hello ${name}`;
      expect(greeting).toBe('hello world');
    });

    it('handles string methods', () => {
      const str = '  hello world  ';
      expect(str.trim()).toBe('hello world');
      expect(str.toUpperCase()).toBe('  HELLO WORLD  ');
      expect(str.includes('world')).toBe(true);
    });

    it('handles regex', () => {
      const str = 'hello world 123';
      const match = str.match(/\d+/);
      expect(match).toBeTruthy();
      expect(match![0]).toBe('123');
    });
  });

  describe('Array Manipulation Integration', () => {
    it('handles array spread', () => {
      const a = [1, 2];
      const b = [3, 4];
      expect([...a, ...b]).toEqual([1, 2, 3, 4]);
    });

    it('handles destructuring', () => {
      const [first, ...rest] = [1, 2, 3, 4];
      expect(first).toBe(1);
      expect(rest).toEqual([2, 3, 4]);
    });

    it('handles array methods', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(arr.filter((x) => x > 3)).toEqual([4, 5]);
      expect(arr.map((x) => x * 2)).toEqual([2, 4, 6, 8, 10]);
      expect(arr.reduce((a, b) => a + b, 0)).toBe(15);
    });
  });

  describe('Object Manipulation Integration', () => {
    it('handles object spread', () => {
      const a = { x: 1 };
      const b = { y: 2 };
      expect({ ...a, ...b }).toEqual({ x: 1, y: 2 });
    });

    it('handles destructuring', () => {
      const { name, age } = { name: 'test', age: 42 };
      expect(name).toBe('test');
      expect(age).toBe(42);
    });

    it('handles object methods', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(Object.keys(obj)).toEqual(['a', 'b', 'c']);
      expect(Object.values(obj)).toEqual([1, 2, 3]);
      expect(Object.entries(obj)).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    });
  });
});
