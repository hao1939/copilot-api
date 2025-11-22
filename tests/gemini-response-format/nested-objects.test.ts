import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Nested Objects in responseSchema", () => {
  it("should handle nested objects in responseSchema", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Create data" }],
        },
      ],
      generationConfig: {
        responseSchema: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                profile: {
                  type: "object",
                  properties: {
                    age: {
                      type: "integer",
                    },
                  },
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

    // Check all nested objects have additionalProperties: false
    expect(schema.additionalProperties).toBe(false)
    const properties = schema.properties as {
      user: {
        additionalProperties: boolean
        properties: {
          profile: {
            additionalProperties: boolean
            properties: { age: { type: string } }
          }
        }
      }
    }
    expect(properties.user.additionalProperties).toBe(false)
    expect(properties.user.properties.profile.additionalProperties).toBe(false)

    // Integer types should be preserved
    expect(properties.user.properties.profile.properties.age.type).toBe(
      "integer",
    )
  })
})
