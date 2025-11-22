import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Undefined Response Format", () => {
  it("should return undefined when no response format specified", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello" }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.response_format).toBeUndefined()
  })
})
