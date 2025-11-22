import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Schema additionalProperties Compliance", () => {
  it("should add additionalProperties: false to all object schemas", () => {
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
              name: "test_tool",
              description: "Test",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
                required: ["name"],
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.tools).toBeDefined()
    expect(openAIPayload.tools?.[0].function.parameters).toHaveProperty(
      "additionalProperties",
      false,
    )
  })

  it("should handle tools with parameters field instead of parametersJsonSchema", () => {
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
              name: "test_tool",
              description: "Test",
              // Using 'parameters' instead of 'parametersJsonSchema'
              parameters: {
                type: "object",
                properties: {
                  file_path: { type: "string" },
                },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.tools?.[0].function.parameters).toHaveProperty(
      "additionalProperties",
      false,
    )
  })

  it("should handle empty or missing tool schemas", () => {
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
              name: "no_params_tool",
              description: "No params",
              parametersJsonSchema: {},
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should provide minimal valid schema
    expect(openAIPayload.tools?.[0].function.parameters).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    })
  })
})
