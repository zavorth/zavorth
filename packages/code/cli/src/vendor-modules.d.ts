/**
 * Ambient modules for optional / loosely typed deps used by CLI tooling paths.
 * Keeps full-project typecheck green without requiring every optional package
 * to ship complete types into the monorepo install graph.
 */

declare module "prettier" {
  export function format(source: string, options?: Record<string, unknown>): Promise<string> | string
  const prettier: {
    format: typeof format
    default?: { format: typeof format }
  }
  export default prettier
}

declare module "prettier/plugins/babel" {
  const plugin: unknown
  export default plugin
}

declare module "prettier/plugins/estree" {
  const plugin: unknown
  export default plugin
}

declare module "mime-types" {
  export function lookup(path: string): string | false
  export function contentType(type: string): string | false
  export function extension(type: string): string | false
  export function charset(type: string): string | false
}
