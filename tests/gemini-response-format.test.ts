import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"
import type { ChatCompletionResponse } from "~/services/copilot/create-chat-completions"

import {
  translateGeminiToOpenAI,
  translateOpenAIToGemini,
} from "~/routes/gemini/translation"

describe("Gemini Response Format Translation", () => {
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

  it("should translate responseSchema to json_schema mode", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Create a person" }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Person's name",
            },
            age: {
              type: "integer",
              description: "Person's age",
            },
          },
          required: ["name", "age"],
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "gemini_response_schema",
        strict: true,
      },
    })

    // Check schema was processed
    const schema = (openAIPayload.response_format as any)?.json_schema?.schema
    expect(schema).toBeDefined()
    expect(schema.type).toBe("object")
    expect(schema.additionalProperties).toBe(false)

    // Integer types should be preserved (GitHub Copilot accepts them)
    expect(schema.properties.age.type).toBe("integer")
  })

  it("should handle nested objects in responseSchema", () => {
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
            user: {
              type: "object",
              properties: {
                profile: {
                  type: "object",
                  properties: {
                    age: {
                      type: "integer",
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const schema = (openAIPayload.response_format as any)?.json_schema?.schema

    // Check all nested objects have additionalProperties: false
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.user.additionalProperties).toBe(false)
    expect(schema.properties.user.properties.profile.additionalProperties).toBe(
      false,
    )

    // Integer types should be preserved
    expect(schema.properties.user.properties.profile.properties.age.type).toBe(
      "integer",
    )
  })

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

  it("should handle array schemas in responseSchema", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "List users" }],
        },
      ],
      generationConfig: {
        responseSchema: {
          type: "object",
          properties: {
            users: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  age: { type: "integer" },
                },
              },
            },
          },
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const schema = (openAIPayload.response_format as any)?.json_schema?.schema

    // Check array items are processed
    expect(schema.properties.users.items.additionalProperties).toBe(false)
    expect(schema.properties.users.items.properties.age.type).toBe("integer")
  })
})

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
