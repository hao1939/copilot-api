import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Orphaned Function Response Handling", () => {
  it("should handle orphaned response in the middle of conversation", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        // First valid call/response pair
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
        // Orphaned response in the middle
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "orphaned-middle",
                name: "orphaned_function",
                response: { data: "orphaned" },
              },
            },
          ],
        },
        // Regular conversation continues
        {
          role: "user",
          parts: [{ text: "Read that file" }],
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
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const assistantMessages = openAIPayload.messages.filter(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )
    const totalToolCalls = assistantMessages.reduce(
      (sum, msg) => sum + (msg.tool_calls?.length || 0),
      0,
    )

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

    // Should have 2 tool calls and 2 tool messages (orphaned middle response skipped)
    expect(totalToolCalls).toBe(2)
    expect(toolMessages.length).toBe(2)

    // Verify the IDs still match correctly
    expect(toolMessages[0].tool_call_id).toBe(
      assistantMessages[0]?.tool_calls?.[0].id,
    )
    expect(toolMessages[1].tool_call_id).toBe(
      assistantMessages[1]?.tool_calls?.[0].id,
    )
  })
})
