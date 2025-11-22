import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Nested Object Schema Compliance", () => {
  describe("should recursively add additionalProperties to nested objects", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "test" }],
        },
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: "complex_tool",
              description: "Complex",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  config: {
                    type: "object",
                    properties: {
                      settings: {
                        type: "object",
                        properties: {
                          enabled: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    const params = openAIPayload.tools?.[0].function.parameters as Record<
      string,
      unknown
    >

    it("should add additionalProperties: false to the top-level object", () => {
      // Top level should have additionalProperties: false
      expect(params).toHaveProperty("additionalProperties", false)
    })

    it("should add additionalProperties: false to the nested config object", () => {
      // Nested config object should have it
      const properties = params.properties as {
        config: { additionalProperties: boolean }
      }
      expect(properties.config).toHaveProperty("additionalProperties", false)
    })

    it("should add additionalProperties: false to the deeply nested settings object", () => {
      // Deeply nested settings object should have it
      const properties = params.properties as {
        config: { properties: { settings: { additionalProperties: boolean } } }
      }
      expect(properties.config.properties.settings).toHaveProperty(
        "additionalProperties",
        false,
      )
    })
  })
})
