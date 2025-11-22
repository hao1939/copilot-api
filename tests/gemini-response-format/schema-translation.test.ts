import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Gemini to OpenAI Schema Translation", () => {
  it("should translate responseMimeType=application/json without schema to json_object", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Return a JSON object" }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.response_format).toEqual({ type: "json_object" })
  })
})
