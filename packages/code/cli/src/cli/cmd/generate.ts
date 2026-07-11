import { Server } from "../../server/server"
import type { CommandModule } from "yargs"

export const GenerateCommand = {
  command: "generate",
  handler: async () => {
    const specs = await Server.openapi()
    for (const item of Object.values(specs.paths)) {
      for (const method of ["get", "post", "put", "delete", "patch"] as const) {
        const operation = item[method]
        if (!operation?.operationId) continue
        // @ts-expect-error
        operation["x-codeSamples"] = [
          {
            lang: "js",
            source: [
              `import { createZavorthClient } from "@zavorth/sdk`,
              ``,
              `const client = createZavorthClient()`,
              `await client.${operation.operationId}({`,
              `  ...`,
              `})`,
            ].join("\n"),
          },
        ]
      }
    }
    const raw = JSON.stringify(specs, null, 2)

    // Prefer prettier when installed (dev). Use string import paths so release
    // binary compiles without resolving prettier into the graph.
    let json = `${raw}\n`
    try {
      const prettierId = ["prettier"].join("")
      const babelId = ["prettier", "plugins", "babel"].join("/")
      const estreeId = ["prettier", "plugins", "estree"].join("/")
      const prettier = await import(prettierId)
      const babel = await import(babelId)
      const estree = await import(estreeId)
      const format = prettier.format ?? prettier.default?.format
      if (typeof format === "function") {
        json = await format(raw, {
          parser: "json",
          plugins: [babel.default ?? babel, estree.default ?? estree],
          printWidth: 120,
        })
      }
    } catch {
      // keep raw JSON — fine for generate command and for compiled binaries
    }

    // Wait for stdout to finish writing before process.exit() is called
    await new Promise<void>((resolve, reject) => {
      process.stdout.write(json, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  },
} satisfies CommandModule
