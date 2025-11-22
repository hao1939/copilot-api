import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Duplicate Function Response Deduplication", () => {
  it("should deduplicate function responses with same ID", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "List files" }],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "list_directory",
                args: { dir_path: "." },
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            // Duplicate responses with same ID (simulating gemini-cli bug)
            {
              functionResponse: {
                id: "list-123-duplicate",
                name: "list_directory",
                response: { output: "files" },
              },
            },
            {
              functionResponse: {
                id: "list-123-duplicate", // Same ID!
                name: "list_directory",
                response: { output: "files" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

    // Should only have ONE tool message despite two responses
    expect(toolMessages.length).toBe(1)
  })

  it("should keep function responses with different IDs", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Multiple ops" }],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "list_directory",
                args: { dir_path: "." },
              },
            },
            {
              functionCall: {
                name: "read_file",
                args: { file_path: "test.txt" },
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "list-123",
                name: "list_directory",
                response: { output: "files" },
              },
            },
            {
              functionResponse: {
                id: "read-456", // Different ID
                name: "read_file",
                response: { content: "hello" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

    // Should have BOTH tool messages
    expect(toolMessages.length).toBe(2)
  })
})
