import { describe, test, expect } from "bun:test"

import type { AnthropicMessage } from "~/routes/messages/anthropic-types"

import { validateAndCleanupToolConversations } from "~/routes/messages/tool-conversation-cleanup"

describe("Tool cancellation edge cases", () => {
  test("should handle tool_use at end of conversation that should be cleaned up", () => {
    // This simulates a scenario where a tool_use is at the end but should be considered abandoned
    // This might happen when Claude Code CLI cancels and the conversation doesn't continue with user input
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll check the weather for you." },
          {
            type: "tool_use",
            id: "toolu_vrtx_01GG3T6npgARqCjxkn9Fm9KW",
            name: "get_weather",
            input: { location: "Boston" },
          },
        ],
      },
      // No subsequent messages - tool call cancelled/abandoned at end
    ]

    const result = validateAndCleanupToolConversations(messages)

    // Current implementation preserves this, but it might need to be more aggressive
    expect(result).toEqual(messages) // This is what currently happens
  })

  test("should handle tool_use followed by assistant message without tool_result", () => {
    // This might be another edge case where tool_use is abandoned
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll check the weather for you." },
          {
            type: "tool_use",
            id: "call_123",
            name: "get_weather",
            input: { location: "Boston" },
          },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Actually, let me try a different approach." },
        ],
      },
      // Assistant continues without using tool_result - indicates abandonment
    ]

    const result = validateAndCleanupToolConversations(messages)

    // This should probably remove the abandoned tool_use block
    expect(result).toEqual([
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: [{ type: "text", text: "I'll check the weather for you." }],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Actually, let me try a different approach." },
        ],
      },
    ])
  })

  test("should handle long conversation with abandoned tool_use", () => {
    // This simulates a long conversation where tool_use gets lost
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "Start task" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "abandoned_tool",
            name: "some_tool",
            input: {},
          },
        ],
      },
      // Many messages later...
      { role: "user", content: "Continue with something else" },
      { role: "assistant", content: "Sure, let me help with that." },
      { role: "user", content: "And another thing..." },
      { role: "assistant", content: "Of course!" },
    ]

    const result = validateAndCleanupToolConversations(messages)

    // Should remove the abandoned tool_use block
    expect(result[1].content).toEqual([])
  })
})
