import { describe, test, expect } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "../src/routes/gemini/translation"

describe("GitHub Copilot conversation ending requirements", () => {
  test("should append user message when conversation ends with tool message", () => {
    // This is the main fix: GitHub Copilot rejects conversations ending with tool messages
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather?" }],
        },
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
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "getWeather",
                response: { temperature: 75 },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should have 4 messages: user, assistant+tool_calls, tool, appended user
    expect(openAIPayload.messages).toHaveLength(4)

    // Verify the appended user message
    const lastMessage = openAIPayload.messages[3]
    expect(lastMessage.role).toBe("user")
    expect(lastMessage.content).toBe("Please continue with the next step.")
  })

  test("should NOT append user message when ending with user message", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello" }],
        },
        {
          role: "model",
          parts: [{ text: "Hi!" }],
        },
        {
          role: "user",
          parts: [{ text: "How are you?" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should have exactly 3 messages, no extra appended
    expect(openAIPayload.messages).toHaveLength(3)
    expect(openAIPayload.messages[2].role).toBe("user")
    expect(openAIPayload.messages[2].content).toBe("How are you?")
  })

  test("should NOT append user message when ending with assistant message", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello" }],
        },
        {
          role: "model",
          parts: [{ text: "Hi there!" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should have exactly 2 messages, no extra appended
    expect(openAIPayload.messages).toHaveLength(2)
    expect(openAIPayload.messages[1].role).toBe("assistant")
    expect(openAIPayload.messages[1].content).toBe("Hi there!")
  })

  test("should handle multiple tool calls ending with tool response", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Get weather and time" }],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "getWeather",
                args: {},
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "getWeather",
                response: { temp: 75 },
              },
            },
          ],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "getTime",
                args: {},
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "getTime",
                response: { time: "3pm" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should append user message since last message is tool response
    const lastMessage = openAIPayload.messages.at(-1)
    if (lastMessage) {
      expect(lastMessage.role).toBe("user")
      expect(lastMessage.content).toBe("Please continue with the next step.")
    }

    // Second to last should be tool
    const secondLast = openAIPayload.messages.at(-2)
    if (secondLast) {
      expect(secondLast.role).toBe("tool")
    }
  })

  test("should preserve consecutive user messages (GitHub Copilot supports this)", () => {
    // During debugging we confirmed GitHub Copilot DOES accept consecutive user messages
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "First" }],
        },
        {
          role: "user",
          parts: [{ text: "Second" }],
        },
        {
          role: "user",
          parts: [{ text: "Third" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should have 3 consecutive user messages (not merged)
    expect(openAIPayload.messages).toHaveLength(3)
    expect(openAIPayload.messages[0].role).toBe("user")
    expect(openAIPayload.messages[0].content).toBe("First")
    expect(openAIPayload.messages[1].role).toBe("user")
    expect(openAIPayload.messages[1].content).toBe("Second")
    expect(openAIPayload.messages[2].role).toBe("user")
    expect(openAIPayload.messages[2].content).toBe("Third")
  })

  test("should handle empty messages array", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should not crash, should return empty messages
    expect(openAIPayload.messages).toHaveLength(0)
  })

  test("should handle conversation with only system message", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [],
      systemInstruction: {
        role: "user",
        parts: [{ text: "You are a helpful assistant" }],
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should have only system message, no appended user message
    expect(openAIPayload.messages).toHaveLength(1)
    expect(openAIPayload.messages[0].role).toBe("system")
  })
})
