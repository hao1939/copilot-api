import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Multiple Tool Call ID Matching", () => {
  it("should handle multiple tool calls with matching IDs", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "List and read" }],
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
                id: "read-456",
                name: "read_file",
                response: { content: "hello" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const assistantMessage = openAIPayload.messages.find(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )
    expect(assistantMessage?.tool_calls?.length).toBe(2)

    const toolCallIds = assistantMessage?.tool_calls?.map((tc) => tc.id) ?? []

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")
    expect(toolMessages.length).toBe(2)

    // Verify IDs match in order
    expect(toolMessages[0].tool_call_id).toBe(toolCallIds[0])
    expect(toolMessages[1].tool_call_id).toBe(toolCallIds[1])
  })
})
