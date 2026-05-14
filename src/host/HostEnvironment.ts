export function sanitizeWindowsEnv(envMap: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (process.platform !== 'win32') {
    return { ...envMap };
  }

  const sanitized: NodeJS.ProcessEnv = {};
  let resolvedPathValue: string | undefined;

  for (const [key, value] of Object.entries(envMap || {})) {
    if (/^path$/i.test(key)) {
      if (key === 'Path' || resolvedPathValue === undefined) {
        resolvedPathValue = value;
      }
      continue;
    }

    sanitized[key] = value;
  }

  if (resolvedPathValue !== undefined) {
    sanitized.Path = resolvedPathValue;
  }

  return sanitized;
}
