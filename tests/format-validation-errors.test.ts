import { describe, it, expect } from "bun:test"

import { formatValidationErrors } from "~/routes/gemini/schema-validator"

describe("formatValidationErrors", () => {
  it("should format errors into a readable string", () => {
    const errors = [
      {
        path: "root.properties.name",
        message: "Missing additionalProperties",
        schema: { type: "object" },
      },
      {
        path: "root.items",
        message: "Array must have items",
      },
    ]

    const formatted = formatValidationErrors(errors)
    expect(formatted).toContain("root.properties.name")
    expect(formatted).toContain("Missing additionalProperties")
    expect(formatted).toContain("root.items")
    expect(formatted).toContain("Array must have items")
  })

  it("should handle an empty errors array", () => {
    const formatted = formatValidationErrors([])
    expect(formatted).toBe("No validation errors")
  })
})
