import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Orphaned Function Response Handling", () => {
  it("should handle all responses being orphaned", () => {
    // Edge case: conversation has only function responses but no function calls
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello" }],
        },
        {
          role: "model",
          parts: [{ text: "Hi there" }],
        },
        // Orphaned responses
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

    const assistantMessages = openAIPayload.messages.filter(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )
    const totalToolCalls = assistantMessages.reduce(
      (sum, msg) => sum + (msg.tool_calls?.length || 0),
      0,
    )

    const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

    // Should have 0 tool calls and 0 tool messages (all responses are orphaned)
    expect(totalToolCalls).toBe(0)
    expect(toolMessages.length).toBe(0)

    // Should still have the regular conversation messages
    expect(openAIPayload.messages.length).toBeGreaterThanOrEqual(2)
  })
})
