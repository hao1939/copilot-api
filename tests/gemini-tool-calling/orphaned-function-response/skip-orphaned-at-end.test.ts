import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Orphaned Function Response Handling", () => {
  it("should skip orphaned function response when there are more responses than calls", () => {
    // Simulates the real-world scenario where a client sends an extra function response
    // without a corresponding function call
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Read file" }],
        },
        {
          role: "model",
          parts: [
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
                id: "read_file-123",
                name: "read_file",
                response: { content: "file content" },
              },
            },
          ],
        },
        // User sends another function response without a corresponding call
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "orphaned-456",
                name: "orphaned_function",
                response: { data: "orphaned data" },
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

    // Should have 1 tool call and 1 tool message (orphaned response should be skipped)
    expect(totalToolCalls).toBe(1)
    expect(toolMessages.length).toBe(1)

    // Verify the valid response is included
    expect(toolMessages[0].tool_call_id).toBe(
      assistantMessages[0]?.tool_calls?.[0].id,
    )
    expect(toolMessages[0].content).toBe('{"content":"file content"}')
  })
})
