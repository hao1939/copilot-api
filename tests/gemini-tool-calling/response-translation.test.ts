import { describe, expect, it } from "bun:test"

import type { ChatCompletionResponse } from "~/services/copilot/create-chat-completions"

import { translateOpenAIToGemini } from "~/routes/gemini/translation"

describe("Response Translation", () => {
  it("should translate OpenAI response with tool_calls to Gemini format", () => {
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
            content: null,
            tool_calls: [
              {
                id: "call_abc123",
                type: "function",
                function: {
                  name: "list_directory",
                  arguments: '{"dir_path":"."}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)

    expect(geminiResponse.candidates[0].content.parts).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.parts[0]).toHaveProperty(
      "functionCall",
    )

    const functionCallPart = geminiResponse.candidates[0].content.parts[0] as {
      functionCall: { name: string; args: Record<string, unknown> }
    }
    expect(functionCallPart.functionCall.name).toBe("list_directory")
    expect(functionCallPart.functionCall.args).toEqual({ dir_path: "." })
  })

  it("should translate finish_reason correctly for tool_calls", () => {
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
            content: null,
            tool_calls: [
              {
                id: "call_abc123",
                type: "function",
                function: {
                  name: "test_tool",
                  arguments: "{}",
                },
              },
            ],
          },
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)

    // tool_calls should map to STOP, not OTHER
    expect(geminiResponse.candidates[0].finishReason).toBe("STOP")
  })

  it("should handle null finish_reason", () => {
    // @ts-expect-error - Testing handling of null finish_reason
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
            content: "Partial response",
          },
          finish_reason: null,
          logprobs: null,
        },
      ],
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)

    // null finish_reason should map to undefined, not OTHER
    expect(geminiResponse.candidates[0].finishReason).toBeUndefined()
  })
})
