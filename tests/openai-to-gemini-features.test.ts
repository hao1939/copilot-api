import { describe, test, expect } from "bun:test"

import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
} from "~/services/copilot/create-chat-completions"

import { translateOpenAIToGemini } from "../src/routes/gemini/translation"

describe("OpenAI to Gemini response features", () => {
  test("should translate response with safety ratings", () => {
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
            content: "This is a safe response.",
            tool_calls: undefined,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)

    expect(geminiResponse.candidates).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.role).toBe("model")
    expect(geminiResponse.candidates[0].content.parts).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.parts[0]).toEqual({
      text: "This is a safe response.",
    })
    expect(geminiResponse.candidates[0].finishReason).toBe("STOP")

    // Verify usage metadata
    expect(geminiResponse.usageMetadata).toBeDefined()
    expect(geminiResponse.usageMetadata?.promptTokenCount).toBe(10)
    expect(geminiResponse.usageMetadata?.candidatesTokenCount).toBe(20)
    expect(geminiResponse.usageMetadata?.totalTokenCount).toBe(30)
  })

  test("should handle streaming response with finish_reason", () => {
    const openAIChunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gemini-2.5-pro",
      choices: [
        {
          index: 0,
          delta: {
            content: "Hello",
          },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(openAIChunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts[0]).toEqual({
      text: "Hello",
    })
    expect(geminiChunk.candidates[0].finishReason).toBe("STOP")
  })

  test("should handle streaming response with tool calls", () => {
    const openAIChunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gemini-2.5-pro",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_123",
                type: "function",
                function: {
                  name: "getWeather",
                  arguments: '{"location":"SF"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(openAIChunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts[0]).toEqual({
      functionCall: {
        name: "getWeather",
        args: { location: "SF" },
      },
    })
    expect(geminiChunk.candidates[0].finishReason).toBe("STOP")
  })
})
