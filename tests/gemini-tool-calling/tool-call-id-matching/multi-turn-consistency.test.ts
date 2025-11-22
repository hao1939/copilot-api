import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Multi-Turn Tool Call ID Consistency", () => {
  it("should maintain ID consistency across multiple turns", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        // First turn
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
                name: "list_directory",
                response: { output: "file1.txt" },
              },
            },
          ],
        },
        // Second turn
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
                name: "read_file",
                response: { content: "hello" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Find both assistant messages with tool_calls
    const assistantMessages = openAIPayload.messages.filter(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )
    expect(assistantMessages.length).toBe(2)

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")
    expect(toolMessages.length).toBe(2)

    // First turn IDs should match
    expect(toolMessages[0].tool_call_id).toBe(
      assistantMessages[0]?.tool_calls?.[0].id,
    )
    // Second turn IDs should match
    expect(toolMessages[1].tool_call_id).toBe(
      assistantMessages[1]?.tool_calls?.[0].id,
    )
  })
})
