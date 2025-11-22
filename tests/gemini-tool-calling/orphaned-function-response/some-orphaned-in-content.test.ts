import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Orphaned Function Response Handling", () => {
  it("should handle content with multiple responses where some are orphaned", () => {
    // This tests the case where a single content has multiple function responses
    // but only some of them have corresponding function calls
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Do multiple tasks" }],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "task_1",
                args: { param: "value1" },
              },
            },
            {
              functionCall: {
                name: "task_2",
                args: { param: "value2" },
              },
            },
          ],
        },
        // Content with 3 responses, but only 2 corresponding calls
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                id: "task1-123",
                name: "task_1",
                response: { result: "result1" },
              },
            },
            {
              functionResponse: {
                id: "task2-456",
                name: "task_2",
                response: { result: "result2" },
              },
            },
            {
              functionResponse: {
                id: "orphaned-789",
                name: "task_3",
                response: { result: "orphaned" },
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

    // Should have 2 tool calls and 2 tool messages (third response is orphaned)
    expect(totalToolCalls).toBe(2)
    expect(toolMessages.length).toBe(2)

    // Verify both valid responses are included
    expect(toolMessages[0].content).toBe('{"result":"result1"}')
    expect(toolMessages[1].content).toBe('{"result":"result2"}')
  })
})
