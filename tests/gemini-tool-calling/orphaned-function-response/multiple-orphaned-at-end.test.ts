import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Orphaned Function Response Handling", () => {
  it("should handle multiple orphaned responses at the end", () => {
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
            {
              functionResponse: {
                id: "list-123",
                name: "list_directory",
                response: { output: "file1.txt" },
              },
            },
          ],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "read_file",
                args: { file_path: "file1.txt" },
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "read-456",
                name: "read_file",
                response: { content: "hello" },
              },
            },
          ],
        },
        // Two orphaned responses
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "orphaned-1",
                name: "orphaned_func_1",
                response: { data: "orphaned 1" },
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "orphaned-2",
                name: "orphaned_func_2",
                response: { data: "orphaned 2" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Count tool calls and tool messages
    const assistantMessages = openAIPayload.messages.filter(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )
    const totalToolCalls = assistantMessages.reduce(
      (sum, msg) => sum + (msg.tool_calls?.length || 0),
      0,
    )

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

    // Should have 2 tool calls and 2 tool messages (2 orphaned responses should be skipped)
    expect(totalToolCalls).toBe(2)
    expect(toolMessages.length).toBe(2)
  })
})
