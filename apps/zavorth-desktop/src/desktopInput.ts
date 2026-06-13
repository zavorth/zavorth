export function appendFileReference(current: string, filePath: string): string {
  const ref = `@file:"${filePath}"`;
  if (!current) {
    return ref;
  }
  return current.endsWith(' ') ? `${current}${ref}` : `${current} ${ref}`;
}
