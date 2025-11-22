import { describe, test, expect } from "bun:test"

import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
} from "~/services/copilot/create-chat-completions"

import { translateOpenAIToGemini } from "../src/routes/gemini/translation"

describe("Gemini streaming - basic finish reasons", () => {
  test("should handle streaming chunk with finishReason=stop", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
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

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    expect(geminiChunk.candidates[0].finishReason).toBe("STOP")
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts[0]).toEqual({
      text: "Hello",
    })
  })

  test("should handle streaming chunk with finishReason=null (mid-stream)", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {
            content: "Hello",
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    // finishReason should not be included when it's null/undefined
    expect(geminiChunk.candidates[0].finishReason).toBeUndefined()
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts[0]).toEqual({
      text: "Hello",
    })
  })

  test("should handle empty streaming chunk (no content, no finish_reason)", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null,
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    // Empty parts array when no content
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(0)
    expect(geminiChunk.candidates[0].finishReason).toBeUndefined()
  })

  test("should handle streaming chunk with only finish_reason (final chunk)", () => {
    // This simulates the final chunk that only contains finish_reason
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    expect(geminiChunk.candidates[0].finishReason).toBe("STOP")
    // Empty parts is acceptable when finishReason is present
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(0)
  })

  test("should handle streaming chunk with tool_calls finish_reason", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
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

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    // tool_calls should map to STOP in Gemini
    expect(geminiChunk.candidates[0].finishReason).toBe("STOP")
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts[0]).toEqual({
      functionCall: {
        name: "getWeather",
        args: { location: "SF" },
      },
    })
  })

  test("should handle streaming chunk with length finish_reason", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {
            content: "...",
          },
          finish_reason: "length",
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    expect(geminiChunk.candidates[0].finishReason).toBe("MAX_TOKENS")
  })

  test("should handle streaming chunk with content_filter finish_reason", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "content_filter",
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates).toHaveLength(1)
    expect(geminiChunk.candidates[0].finishReason).toBe("SAFETY")
  })
})

describe("Gemini streaming - streaming sequences", () => {
  test("should handle streaming sequence: content chunks then final stop", () => {
    // Simulates a typical streaming sequence
    const chunks: Array<ChatCompletionChunk> = [
      // First chunk with content
      {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: { content: "Hello" },
            finish_reason: null,
            logprobs: null,
          },
        ],
      },
      // Second chunk with more content
      {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: { content: " world" },
            finish_reason: null,
            logprobs: null,
          },
        ],
      },
      // Final chunk with finish_reason
      {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
            logprobs: null,
          },
        ],
      },
    ]

    const geminiChunks = chunks.map((chunk) => translateOpenAIToGemini(chunk))

    // First chunk: has content, no finishReason
    expect(geminiChunks[0].candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunks[0].candidates[0].content.parts[0]).toEqual({
      text: "Hello",
    })
    expect(geminiChunks[0].candidates[0].finishReason).toBeUndefined()

    // Second chunk: has content, no finishReason
    expect(geminiChunks[1].candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunks[1].candidates[0].content.parts[0]).toEqual({
      text: " world",
    })
    expect(geminiChunks[1].candidates[0].finishReason).toBeUndefined()

    // Final chunk: no content, has finishReason
    expect(geminiChunks[2].candidates[0].content.parts).toHaveLength(0)
    expect(geminiChunks[2].candidates[0].finishReason).toBe("STOP")
  })
})

describe("Gemini streaming - metadata and edge cases", () => {
  test("should handle chunk with usage metadata", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        prompt_tokens_details: {
          cached_tokens: 5,
        },
      },
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.usageMetadata).toBeDefined()
    expect(geminiChunk.usageMetadata?.promptTokenCount).toBe(10)
    expect(geminiChunk.usageMetadata?.candidatesTokenCount).toBe(20)
    expect(geminiChunk.usageMetadata?.totalTokenCount).toBe(30)
    expect(geminiChunk.usageMetadata?.cachedContentTokenCount).toBe(5)
  })

  test("should handle chunk without choices array", () => {
    // Edge case: chunk with no choices (shouldn't happen but be defensive)
    const chunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk" as const,
      created: 1234567890,
      model: "gpt-4",
      choices: [],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    // Should return empty candidates
    expect(geminiChunk.candidates).toHaveLength(0)
  })

  test("should differentiate between stop and tool_calls finish reasons", () => {
    // Both should map to "STOP" in Gemini, but verify the translation
    const stopChunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    }

    const toolCallsChunk: ChatCompletionChunk = {
      id: "chatcmpl-124",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
    }

    const geminiStopChunk = translateOpenAIToGemini(stopChunk)
    const geminiToolCallsChunk = translateOpenAIToGemini(toolCallsChunk)

    // Both should translate to STOP in Gemini
    expect(geminiStopChunk.candidates[0].finishReason).toBe("STOP")
    expect(geminiToolCallsChunk.candidates[0].finishReason).toBe("STOP")
  })

  test("should handle non-streaming response format", () => {
    // Verify that non-streaming responses are also handled correctly
    const response: ChatCompletionResponse = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Hello, how can I help?",
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

    const geminiResponse = translateOpenAIToGemini(response)

    expect(geminiResponse.candidates).toHaveLength(1)
    expect(geminiResponse.candidates[0].finishReason).toBe("STOP")
    expect(geminiResponse.candidates[0].content.parts).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.parts[0]).toEqual({
      text: "Hello, how can I help?",
    })
    expect(geminiResponse.usageMetadata).toBeDefined()
  })
})

describe("Gemini streaming edge cases", () => {
  test("should handle complete tool call arguments", () => {
    // OpenAI sends complete tool call with valid JSON arguments
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
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
          finish_reason: null,
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(1)
    expect(geminiChunk.candidates[0].content.parts[0]).toEqual({
      functionCall: {
        name: "getWeather",
        args: { location: "SF" },
      },
    })
  })

  test("should handle tool call delta without function name (incremental)", () => {
    // In incremental streaming, OpenAI may send deltas without the function name
    // These should be ignored as Gemini expects complete function calls
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  // No name, just incremental arguments
                  arguments: "more data",
                },
              },
            ],
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)
    // Should have empty parts since there's no function name
    expect(geminiChunk.candidates[0].content.parts).toHaveLength(0)
  })

  test("should handle multiple consecutive empty chunks", () => {
    const emptyChunks: Array<ChatCompletionChunk> = [
      {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: null,
            logprobs: null,
          },
        ],
      },
      {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: null,
            logprobs: null,
          },
        ],
      },
    ]

    const geminiChunks = emptyChunks.map((chunk) =>
      translateOpenAIToGemini(chunk),
    )

    // Both should have empty parts and no finishReason
    for (const geminiChunk of geminiChunks) {
      expect(geminiChunk.candidates[0].content.parts).toHaveLength(0)
      expect(geminiChunk.candidates[0].finishReason).toBeUndefined()
    }

    // These empty chunks should be filtered out by the handler
    // (as per the fix in handler.ts)
  })

  test("should preserve role as model in all streaming chunks", () => {
    const chunk: ChatCompletionChunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: {
            content: "Hello",
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    }

    const geminiChunk = translateOpenAIToGemini(chunk)

    expect(geminiChunk.candidates[0].content.role).toBe("model")
  })
})
