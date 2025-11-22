import { describe, it, expect } from "bun:test"
import {
  validateSchemaForStrictMode,
  validateToolsForStrictMode,
  formatValidationErrors,
} from "../src/routes/gemini/schema-validator"

describe("Schema Validator", () => {
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
      expect(result.errors.some((e) => e.message.includes("properties"))).toBe(true)
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

      const result = validateSchemaForStrictMode(schema as any)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes("null"))).toBe(true)
    })
  })

  describe("validateToolsForStrictMode", () => {
    it("should accept valid tools with strict mode", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      ]

      const result = validateToolsForStrictMode(tools as any)
      expect(result.valid).toBe(true)
    })

    it("should reject tool with invalid type", () => {
      const tools = [
        {
          type: "invalid",
          function: {
            name: "test",
            parameters: {},
          },
        },
      ]

      const result = validateToolsForStrictMode(tools as any)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes("type"))).toBe(true)
    })

    it("should reject tool without name", () => {
      const tools = [
        {
          type: "function",
          function: {
            parameters: {},
          },
        },
      ]

      const result = validateToolsForStrictMode(tools as any)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes("name"))).toBe(true)
    })

    it("should validate multiple tools", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "tool1",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            strict: true,
          },
        },
        {
          type: "function",
          function: {
            name: "tool2",
            parameters: {
              type: "object",
              properties: {},
              // Missing additionalProperties: false
            },
            strict: true,
          },
        },
      ]

      const result = validateToolsForStrictMode(tools as any)
      expect(result.valid).toBe(false)
      // Should have error for tool2
      expect(result.errors.some((e) => e.path.includes("tools[1]"))).toBe(true)
    })
  })

  describe("formatValidationErrors", () => {
    it("should format errors into readable string", () => {
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

    it("should handle empty errors array", () => {
      const formatted = formatValidationErrors([])
      expect(formatted).toBe("No validation errors")
    })
  })
})
