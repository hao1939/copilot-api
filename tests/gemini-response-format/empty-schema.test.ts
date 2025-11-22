import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Empty responseSchema with responseMimeType", () => {
  it("should handle empty responseSchema with responseMimeType", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Return JSON" }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {},
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Empty schema should use json_object mode
    expect(openAIPayload.response_format).toEqual({ type: "json_object" })
  })
})
