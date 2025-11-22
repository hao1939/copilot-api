import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Tool Call ID Matching", () => {
  it("should generate matching IDs for tool_calls and tool responses", () => {
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
                id: "list_directory-123-abc",
                name: "list_directory",
                response: { output: "file1.txt, file2.txt" },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Find the assistant message with tool_calls
    const assistantMessage = openAIPayload.messages.find(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )
    expect(assistantMessage).toBeDefined()
    expect(assistantMessage?.tool_calls).toBeDefined()
    expect(assistantMessage?.tool_calls?.length).toBe(1)

    const toolCall = assistantMessage?.tool_calls?.[0]
    expect(toolCall).toBeDefined()

    // Find the tool response message
    const toolMessage = openAIPayload.messages.find((m) => m.role === "tool")
    expect(toolMessage).toBeDefined()
    if (toolMessage) {
      expect(toolMessage.tool_call_id).toBe(toolCall?.id)
    }
  })
})
