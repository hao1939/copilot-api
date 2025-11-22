import { describe, it, expect } from "bun:test"

import { validateSchemaForStrictMode } from "~/routes/gemini/schema-validator"

describe("validateSchemaForStrictMode", () => {
  it("should accept valid object schema with additionalProperties: false", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("should reject object schema without additionalProperties: false", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain("additionalProperties")
  })

  it("should reject object schema without properties field", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("properties"))).toBe(
      true,
    )
  })

  it("should reject array schema without items", () => {
    const schema = {
      type: "array",
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("items"))).toBe(true)
  })

  it("should accept valid array schema with items", () => {
    const schema = {
      type: "array",
      items: {
        type: "string",
      },
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(true)
  })

  it("should reject schema with nullable field", () => {
    const schema = {
      type: "string",
      nullable: true,
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("nullable"))).toBe(true)
  })

  it("should reject schema with $ref", () => {
    const schema = {
      $ref: "#/definitions/MyType",
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("$ref"))).toBe(true)
  })

  it("should validate nested object schemas", () => {
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(true)
  })

  it("should reject nested object without additionalProperties", () => {
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          // Missing additionalProperties: false
        },
      },
      additionalProperties: false,
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
  })

  it("should reject required field not in properties", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name", "age"], // age not in properties
      additionalProperties: false,
    }

    const result = validateSchemaForStrictMode(schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("age"))).toBe(true)
  })

  it("should reject schema with null values", () => {
    const schema = {
      type: "object",
      properties: {
        name: null, // null value not allowed
      },
      additionalProperties: false,
    }

    const result = validateSchemaForStrictMode(
      schema as Record<string, unknown>,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("null"))).toBe(true)
  })
})
