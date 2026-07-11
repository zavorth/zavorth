import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveZavorthHome } from "@zavorth/shared/global"

describe("resolveZavorthHome", () => {
  test("with ZAVORTH_HOME set, resolves 4 subdirs under root", () => {
    const result = resolveZavorthHome({
      ZAVORTH_HOME: "/tmp/profile-a",
    })
    expect(result.mode).toBe("zavorth_home")
    expect(result.root).toBe("/tmp/profile-a")
    expect(result.config).toBe(path.join("/tmp/profile-a", "config"))
    expect(result.data).toBe(path.join("/tmp/profile-a", "data"))
    expect(result.state).toBe(path.join("/tmp/profile-a", "state"))
    expect(result.cache).toBe(path.join("/tmp/profile-a", "cache"))
  })

  test("without ZAVORTH_HOME, falls through to xdg mode", () => {
    const result = resolveZavorthHome({})
    expect(result.mode).toBe("xdg")
    expect(result.root).toBeUndefined()
    // xdg paths end with "/zavorth"
    expect(result.config.endsWith(path.join("", "zavorth"))).toBe(true)
    expect(result.data.endsWith(path.join("", "zavorth"))).toBe(true)
    expect(result.state.endsWith(path.join("", "zavorth"))).toBe(true)
    expect(result.cache.endsWith(path.join("", "zavorth"))).toBe(true)
  })

  test("empty ZAVORTH_HOME string is treated as unset (xdg mode)", () => {
    const result = resolveZavorthHome({ ZAVORTH_HOME: "" })
    expect(result.mode).toBe("xdg")
  })

  test("relative ZAVORTH_HOME path throws with clear error", () => {
    expect(() => resolveZavorthHome({ ZAVORTH_HOME: "./foo" })).toThrow(
      /ZAVORTH_HOME must be an absolute path/,
    )
    expect(() => resolveZavorthHome({ ZAVORTH_HOME: "foo/bar" })).toThrow(
      /ZAVORTH_HOME must be an absolute path/,
    )
  })

  test("tilde-prefixed ZAVORTH_HOME throws (not treated as absolute)", () => {
    expect(() => resolveZavorthHome({ ZAVORTH_HOME: "~/profiles/a" })).toThrow(
      /ZAVORTH_HOME must be an absolute path/,
    )
  })

  test("error message includes the offending value", () => {
    expect(() => resolveZavorthHome({ ZAVORTH_HOME: "./relative" })).toThrow(
      /\.\/relative/,
    )
  })
})
