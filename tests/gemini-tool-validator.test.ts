import { describe, it, expect } from "bun:test"

import { validateToolsForStrictMode } from "~/routes/gemini/schema-validator"

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

    const result = validateToolsForStrictMode(
      tools as Array<{
        type: string
        function: {
          name: string
          description?: string
          parameters: unknown
          strict?: boolean
        }
      }>,
    )
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

    const result = validateToolsForStrictMode(
      tools as Array<{
        type: string
        function: { name: string; parameters: Record<string, unknown> }
      }>,
    )
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

    // @ts-expect-error - Intentionally passing a tool without a name to test validation
    const result = validateToolsForStrictMode(tools)
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

    const result = validateToolsForStrictMode(
      tools as Array<{
        type: string
        function: {
          name: string
          parameters: {
            type: string
            properties: Record<string, unknown>
            additionalProperties?: boolean
          }
          strict: boolean
        }
      }>,
    )
    expect(result.valid).toBe(false)
    // Should have error for tool2
    expect(result.errors.some((e) => e.path.includes("tools[1]"))).toBe(true)
  })
})
