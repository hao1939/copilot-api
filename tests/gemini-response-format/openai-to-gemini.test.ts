import { describe, expect, it } from "bun:test"

import type { ChatCompletionResponse } from "~/services/copilot/create-chat-completions"

import { translateOpenAIToGemini } from "~/routes/gemini/translation"

describe("OpenAI Response Format to Gemini Translation", () => {
  it("should preserve response content when response_format was used", () => {
    // This tests that when OpenAI returns a response that was generated with
    // response_format, we correctly translate it back to Gemini format
    const openAIResponse: ChatCompletionResponse = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gemini-2.5-pro",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ name: "John", age: 30 }),
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)

    expect(geminiResponse.candidates).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.parts).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.parts[0]).toEqual({
      text: JSON.stringify({ name: "John", age: 30 }),
    })
  })
})
