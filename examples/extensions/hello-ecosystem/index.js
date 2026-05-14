export function run(input = {}) {
  const name = typeof input.name === 'string' && input.name.trim()
    ? input.name.trim()
    : 'Zavorth ecosystem';

  return {
    ok: true,
    message: `Hello from ${name}.`,
  };
}
