import { afterEach, describe, expect, test } from "bun:test"
import { resource } from "../../src/effect/observability"

const otelResourceAttributes = process.env.OTEL_RESOURCE_ATTRIBUTES
const zavorthClientEnv = process.env.zavorth_CLIENT

afterEach(() => {
  if (otelResourceAttributes === undefined) delete process.env.OTEL_RESOURCE_ATTRIBUTES
  else process.env.OTEL_RESOURCE_ATTRIBUTES = otelResourceAttributes

  if (zavorthClientEnv === undefined) delete process.env.zavorth_CLIENT
  else process.env.zavorth_CLIENT = zavorthClientEnv
})

describe("resource", () => {
  test("parses and decodes OTEL resource attributes", () => {
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "service.namespace=zavorth,team=platform%2Cobservability,label=hello%3Dworld,key%2Fname=value%20here"

    expect(resource().attributes).toMatchObject({
      "service.namespace": "zavorth",
      team: "platform,observability",
      label: "hello=world",
      "key/name": "value here",
    })
  })

  test("drops OTEL resource attributes when any entry is invalid", () => {
    process.env.OTEL_RESOURCE_ATTRIBUTES = "service.namespace=zavorth,broken"

    expect(resource().attributes["service.namespace"]).toBeUndefined()
    expect(resource().attributes["zavorth.client"]).toBeDefined()
  })

  test("keeps built-in attributes when env values conflict", () => {
    process.env.zavorth_CLIENT = "cli"
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "zavorth.client=web,service.instance.id=override,service.namespace=zavorth"

    expect(resource().attributes).toMatchObject({
      "zavorth.client": "cli",
      "service.namespace": "zavorth",
    })
    expect(resource().attributes["service.instance.id"]).not.toBe("override")
  })
})
