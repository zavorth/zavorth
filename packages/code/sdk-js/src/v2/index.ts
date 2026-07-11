export * from "./client.js"
export * from "./server.js"

import { createZavorthClient } from "./client.js"
import { createZavorthServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createZavorth(options?: ServerOptions) {
  const server = await createZavorthServer({
    ...options,
  })

  const client = createZavorthClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
