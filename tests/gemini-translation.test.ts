import { describe, test, expect } from "bun:test"
import { z } from "zod"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import {
  translateGeminiToOpenAI,
  translateOpenAIToGemini,
} from "../src/routes/gemini/translation"

// Zod schema for OpenAI chat completion request (reused from anthropic tests)
const messageSchema = z.object({
  role: z.enum([
    "system",
    "user",
    "assistant",
    "tool",
    "function",
    "developer",
  ]),
  content: z.union([z.string(), z.object({}), z.array(z.any()), z.null()]),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
})

const chatCompletionRequestSchema = z.object({
  messages: z.array(messageSchema).min(1, "Messages array cannot be empty."),
  model: z.string(),
  frequency_penalty: z.number().min(-2).max(2).optional().nullable(),
  logit_bias: z.record(z.string(), z.number()).optional().nullable(),
  logprobs: z.boolean().optional().nullable(),
  top_logprobs: z.number().int().min(0).max(20).optional().nullable(),
  max_tokens: z.number().int().optional().nullable(),
  n: z.number().int().min(1).max(128).optional().nullable(),
  presence_penalty: z.number().min(-2).max(2).optional().nullable(),
  response_format: z
    .object({
      type: z.enum(["text", "json_object", "json_schema"]),
      json_schema: z.object({}).optional(),
    })
    .optional()
    .nullable(),
  seed: z.number().int().optional().nullable(),
  stop: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable(),
  stream: z.boolean().optional().nullable(),
  temperature: z.number().min(0).max(2).optional().nullable(),
  top_p: z.number().min(0).max(1).optional().nullable(),
  tools: z.array(z.any()).optional().nullable(),
  tool_choice: z
    .union([z.string(), z.object({})])
    .optional()
    .nullable(),
  user: z.string().optional().nullable(),
})

function isValidChatCompletionRequest(payload: unknown): boolean {
  const result = chatCompletionRequestSchema.safeParse(payload)
  return result.success
}

describe("Gemini to OpenAI translation logic", () => {
  test("should translate minimal Gemini payload to valid OpenAI payload", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello!" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    expect(isValidChatCompletionRequest(openAIPayload)).toBe(true)
    expect(openAIPayload.messages).toHaveLength(1)
    expect(openAIPayload.messages[0].role).toBe("user")
    expect(openAIPayload.messages[0].content).toBe("Hello!")
  })

  test("should translate comprehensive Gemini payload to valid OpenAI payload", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "What is the weather like in Boston?" }],
        },
        {
          role: "model",
          parts: [{ text: "The weather in Boston is sunny and 75°F." }],
        },
      ],
      systemInstruction: {
        parts: [{ text: "You are a helpful assistant." }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150,
        topP: 1,
        stopSequences: ["END"],
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "getWeather",
              description: "Gets weather info",
              parameters: { location: { type: "string" } },
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO",
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    expect(isValidChatCompletionRequest(openAIPayload)).toBe(true)
    expect(openAIPayload.messages).toHaveLength(3) // system + user + assistant
    expect(openAIPayload.messages[0].role).toBe("system")
    expect(openAIPayload.messages[0].content).toBe("You are a helpful assistant.")
    expect(openAIPayload.temperature).toBe(0.7)
    expect(openAIPayload.max_tokens).toBe(150)
    expect(openAIPayload.top_p).toBe(1)
    expect(openAIPayload.stop).toEqual(["END"])
    expect(openAIPayload.tools).toHaveLength(1)
    expect(openAIPayload.tool_choice).toBe("auto")
  })

  test("should handle multi-part text content", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Part 1" }, { text: "Part 2" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    expect(isValidChatCompletionRequest(openAIPayload)).toBe(true)
    expect(openAIPayload.messages[0].content).toBe("Part 1\n\nPart 2")
  })

  test("should handle image content", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "What is in this image?" },
            {
              inlineData: {
                mimeType: "image/png",
                data: "base64data",
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    expect(isValidChatCompletionRequest(openAIPayload)).toBe(true)
    expect(Array.isArray(openAIPayload.messages[0].content)).toBe(true)
    const content = openAIPayload.messages[0].content as Array<any>
    expect(content).toHaveLength(2)
    expect(content[0].type).toBe("text")
    expect(content[1].type).toBe("image_url")
    expect(content[1].image_url.url).toBe("data:image/png;base64,base64data")
  })

  test("should handle function calls", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather?" }],
        },
        {
          role: "model",
          parts: [
            { text: "Let me check." },
            {
              functionCall: {
                name: "getWeather",
                args: { location: "Boston" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    expect(isValidChatCompletionRequest(openAIPayload)).toBe(true)
    expect(openAIPayload.messages).toHaveLength(2)
    const assistantMsg = openAIPayload.messages[1]
    expect(assistantMsg.role).toBe("assistant")
    expect(assistantMsg.tool_calls).toHaveLength(1)
    expect(assistantMsg.tool_calls?.[0].function.name).toBe("getWeather")
  })

  test("should handle function responses with matching tool_call IDs", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        // First: user asks a question
        {
          role: "user",
          parts: [{ text: "What's the weather?" }],
        },
        // Second: model calls a function
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "getWeather",
                args: { location: "SF" },
              },
            },
          ],
        },
        // Third: user provides function response
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "getWeather",
                response: { temperature: 75, condition: "sunny" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    expect(isValidChatCompletionRequest(openAIPayload)).toBe(true)

    // Should have 4 messages: user question, assistant tool_call, tool response, and appended user message
    // (The appended user message is added because the conversation ends with a tool message)
    expect(openAIPayload.messages).toHaveLength(4)

    // Check assistant message has tool_calls
    const assistantMsg = openAIPayload.messages[1]
    expect(assistantMsg.role).toBe("assistant")
    expect(assistantMsg.tool_calls).toBeDefined()
    expect(assistantMsg.tool_calls?.[0].function.name).toBe("getWeather")

    // Check tool response message
    const toolMsg = openAIPayload.messages[2]
    expect(toolMsg.role).toBe("tool")

    // CRITICAL: tool_call_id must match the ID from assistant's tool_calls
    expect(toolMsg.tool_call_id).toBe(assistantMsg.tool_calls?.[0].id)
    expect(toolMsg.tool_call_id).toContain("getWeather")

    // Check appended user message (fix for GitHub Copilot)
    const appendedMsg = openAIPayload.messages[3]
    expect(appendedMsg.role).toBe("user")
    expect(appendedMsg.content).toBe("Please continue with the next step.")
  })

  test("should translate toolConfig modes correctly", () => {
    const autoPayload: GeminiGenerateContentPayload = {
      contents: [{ role: "user", parts: [{ text: "test" }] }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    }
    expect(translateGeminiToOpenAI(autoPayload).tool_choice).toBe("auto")

    const anyPayload: GeminiGenerateContentPayload = {
      contents: [{ role: "user", parts: [{ text: "test" }] }],
      toolConfig: { functionCallingConfig: { mode: "ANY" } },
    }
    expect(translateGeminiToOpenAI(anyPayload).tool_choice).toBe("required")

    const nonePayload: GeminiGenerateContentPayload = {
      contents: [{ role: "user", parts: [{ text: "test" }] }],
      toolConfig: { functionCallingConfig: { mode: "NONE" } },
    }
    expect(translateGeminiToOpenAI(nonePayload).tool_choice).toBe("none")
  })
})

describe("OpenAI to Gemini response translation", () => {
  test("should translate minimal OpenAI response to Gemini format", () => {
    const openAIResponse = {
      id: "chatcmpl-123",
      object: "chat.completion" as const,
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: "Hello! How can I help?",
          },
          logprobs: null,
          finish_reason: "stop" as const,
        },
      ],
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)
    expect(geminiResponse.candidates).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.role).toBe("model")
    expect(geminiResponse.candidates[0].content.parts).toHaveLength(1)
    expect(geminiResponse.candidates[0].content.parts[0]).toEqual({
      text: "Hello! How can I help?",
    })
    expect(geminiResponse.candidates[0].finishReason).toBe("STOP")
  })

  test("should translate response with usage metadata", () => {
    const openAIResponse = {
      id: "chatcmpl-123",
      object: "chat.completion" as const,
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: { role: "assistant" as const, content: "Hi" },
          logprobs: null,
          finish_reason: "stop" as const,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        prompt_tokens_details: {
          cached_tokens: 3,
        },
      },
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)
    expect(geminiResponse.usageMetadata?.promptTokenCount).toBe(10)
    expect(geminiResponse.usageMetadata?.candidatesTokenCount).toBe(5)
    expect(geminiResponse.usageMetadata?.totalTokenCount).toBe(15)
    expect(geminiResponse.usageMetadata?.cachedContentTokenCount).toBe(3)
  })

  test("should translate response with tool calls", () => {
    const openAIResponse = {
      id: "chatcmpl-123",
      object: "chat.completion" as const,
      created: 1234567890,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: "Let me check.",
            tool_calls: [
              {
                id: "call_123",
                type: "function" as const,
                function: {
                  name: "getWeather",
                  arguments: JSON.stringify({ location: "Boston" }),
                },
              },
            ],
          },
          logprobs: null,
          finish_reason: "tool_calls" as const,
        },
      ],
    }

    const geminiResponse = translateOpenAIToGemini(openAIResponse)
    expect(geminiResponse.candidates[0].content.parts).toHaveLength(2)
    expect(geminiResponse.candidates[0].content.parts[0]).toEqual({
      text: "Let me check.",
    })
    expect(geminiResponse.candidates[0].content.parts[1]).toEqual({
      functionCall: {
        name: "getWeather",
        args: { location: "Boston" },
      },
    })
    expect(geminiResponse.candidates[0].finishReason).toBe("STOP")
  })

  test("should translate finish reasons correctly", () => {
    const testCases: Array<{
      openai: "stop" | "length" | "content_filter" | "tool_calls"
      gemini:
        | "STOP"
        | "MAX_TOKENS"
        | "SAFETY"
        | "OTHER"
        | "FINISH_REASON_UNSPECIFIED"
        | "RECITATION"
    }> = [
      { openai: "stop", gemini: "STOP" },
      { openai: "length", gemini: "MAX_TOKENS" },
      { openai: "content_filter", gemini: "SAFETY" },
      { openai: "tool_calls", gemini: "STOP" },
    ]

    for (const { openai, gemini } of testCases) {
      const response = {
        id: "test",
        object: "chat.completion" as const,
        created: 123,
        model: "gpt-4",
        choices: [
          {
            index: 0,
            message: { role: "assistant" as const, content: "test" },
            logprobs: null,
            finish_reason: openai,
          },
        ],
      }
      const result = translateOpenAIToGemini(response)
      expect(result.candidates[0].finishReason).toBe(gemini)
    }
  })
})
