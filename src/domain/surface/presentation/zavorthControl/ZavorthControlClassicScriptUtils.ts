  // eslint-disable-next-line @typescript-eslint/ban-types
export function extractFunctionBody(fn: Function): string {
  const source = fn.toString();
  const start = source.indexOf('{') + 1;
  const end = source.lastIndexOf('}');
  return source
    .slice(start, end)
    .replace(/__name\([A-Za-z0-9_$]+,\s*["'][^"']+["']\);?\s*/g, '')
    .trim();
}

