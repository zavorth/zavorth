export function sanitizeSkillId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unnamed-skill';
}

export function sanitizeSkillReceiptId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function quoteSkillSource(value: string): string {
  return /\s/u.test(value) ? `"${value}"` : value;
}
