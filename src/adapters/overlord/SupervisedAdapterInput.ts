export function readStructuredInput(command: string | null | undefined, metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const direct = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  const normalizedCommand = String(command || '').trim();
  if (!normalizedCommand) {
    return direct;
  }

  if (normalizedCommand.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalizedCommand);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...direct,
          ...parsed,
        };
      }
    } catch (error: any) { const err = error; const e = error;
      return {
        ...direct,
        rawCommand: normalizedCommand,
      };
    }
  }

  return {
    ...direct,
    rawCommand: normalizedCommand,
  };
}

export function stringField(input: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = input[name];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function numberField(input: Record<string, unknown>, ...names: string[]): number | null {
  for (const name of names) {
    const value = input[name];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function booleanField(input: Record<string, unknown>, ...names: string[]): boolean | null {
  for (const name of names) {
    const value = input[name];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
  }
  return null;
}

export function stringArrayField(input: Record<string, unknown>, ...names: string[]): string[] {
  for (const name of names) {
    const value = input[name];
    if (Array.isArray(value)) {
      return value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim();
      if (normalized.startsWith('[')) {
        try {
          const parsed = JSON.parse(normalized);
          if (Array.isArray(parsed)) {
            return parsed
              .map((entry) => String(entry || '').trim())
              .filter(Boolean);
          }
        } catch (error: any) { const err = error; const e = error;
          return [normalized];
        }
      }
      return normalized
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function objectField(input: Record<string, unknown>, name: string): Record<string, unknown> | null {
  const value = input[name];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
