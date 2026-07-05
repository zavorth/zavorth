type LogMethod = (...args: unknown[]) => void;

function bindConsole(method: 'debug' | 'info' | 'warn' | 'error'): LogMethod {
  const target = console[method] || console.log;
  return target.bind(console);
}

export const logger = {
  debug: bindConsole('debug'),
  info: bindConsole('info'),
  warn: bindConsole('warn'),
  error: bindConsole('error'),
};
