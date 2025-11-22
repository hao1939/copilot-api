import { describe, test, expect } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "../src/routes/gemini/translation"

describe("Gemini API Features", () => {
  test("should translate systemInstruction to OpenAI system message", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      systemInstruction: {
        parts: [
          {
            text: "You are a helpful assistant specialized in coding.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello!" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Should have 2 messages: system and user
    expect(openAIPayload.messages).toHaveLength(2)
    expect(openAIPayload.messages[0].role).toBe("system")
    expect(openAIPayload.messages[0].content).toBe(
      "You are a helpful assistant specialized in coding.",
    )
    expect(openAIPayload.messages[1].role).toBe("user")
    expect(openAIPayload.messages[1].content).toBe("Hello!")
  })

  test("should translate systemInstruction with multiple text parts", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      systemInstruction: {
        parts: [
          { text: "You are a helpful assistant." },
          { text: "You specialize in coding." },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello!" }],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Multiple text parts should be concatenated with double newlines
    expect(openAIPayload.messages[0].role).toBe("system")
    expect(openAIPayload.messages[0].content).toBe(
      "You are a helpful assistant.\n\nYou specialize in coding.",
    )
  })

  test("should translate generationConfig to OpenAI parameters", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello!" }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
        stopSequences: ["END", "STOP"],
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.temperature).toBe(0.7)
    expect(openAIPayload.top_p).toBe(0.9)
    expect(openAIPayload.max_tokens).toBe(1024)
    expect(openAIPayload.stop).toEqual(["END", "STOP"])
  })

  test("should handle stopSequences as array", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello!" }],
        },
      ],
      generationConfig: {
        stopSequences: ["END"],
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // OpenAI accepts both string and array for stop
    expect(openAIPayload.stop).toEqual(["END"])
  })

  test("should handle inlineData parts (images)", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "What's in this image?" },
            {
              inlineData: {
                mimeType: "image/png",
                data: "base64encodeddata",
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.messages).toHaveLength(1)
    expect(Array.isArray(openAIPayload.messages[0].content)).toBe(true)

    const content = openAIPayload.messages[0].content as Array<{
      type: string
      image_url: { url: string }
    }>
    expect(content).toHaveLength(2)
    expect(content[0].type).toBe("text")
    expect(content[1].type).toBe("image_url")
    expect(content[1].image_url).toEqual({
      url: "data:image/png;base64,base64encodeddata",
    })
  })
})
