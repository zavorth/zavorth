import { describe, expect, test } from "bun:test"
import { Npm } from "../src/npm"

const win = process.platform === "win32"

describe("Npm.sanitize", () => {
  test("keeps normal scoped package specs unchanged", () => {
    expect(Npm.sanitize("@zavorth/acme")).toBe("@zavorth/acme")
    expect(Npm.sanitize("@zavorth/acme@1.0.0")).toBe("@zavorth/acme@1.0.0")
    expect(Npm.sanitize("prettier")).toBe("prettier")
  })

  test("handles git https specs", () => {
    const spec = "acme@git+https://github.com/zavorth/acme.git"
    const expected = win ? "acme@git+https_//github.com/zavorth/acme.git" : spec
    expect(Npm.sanitize(spec)).toBe(expected)
  })
})
