import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Array Schemas in responseSchema", () => {
  it("should handle array schemas in responseSchema", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "List users" }],
        },
      ],
      generationConfig: {
        responseSchema: {
          type: "object",
          properties: {
            users: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  age: { type: "integer" },
                },
              },
            },
          },
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const schema = (
      openAIPayload.response_format as {
        json_schema: { schema: Record<string, unknown> }
      }
    ).json_schema.schema

    // Check array items are processed
    const properties = schema.properties as {
      users: {
        items: {
          additionalProperties: boolean
          properties: { age: { type: string } }
        }
      }
    }
    expect(properties.users.items.additionalProperties).toBe(false)
    expect(properties.users.items.properties.age.type).toBe("integer")
  })
})
