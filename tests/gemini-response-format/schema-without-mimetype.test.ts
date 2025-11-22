import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("responseSchema without responseMimeType", () => {
  it("should handle responseSchema without responseMimeType", () => {
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
            value: { type: "string" },
          },
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.response_format).toMatchObject({
      type: "json_schema",
    })
  })
})
