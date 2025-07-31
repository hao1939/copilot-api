import { describe, test, expect } from "bun:test"

import type { AnthropicMessage } from "~/routes/messages/anthropic-types"

import { validateAndCleanupToolConversations } from "~/routes/messages/tool-conversation-cleanup"

describe("Specific issue reproduction", () => {
  test("should handle the exact tool ID from the error message", () => {
    // This reproduces the exact scenario from the issue with the specific tool ID
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "Help me with some code" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll help you with that code." },
          {
            type: "tool_use",
            id: "toolu_vrtx_01GG3T6npgARqCjxkn9Fm9KW", // Exact ID from error message
            name: "code_editor",
            input: { action: "edit", file: "example.js" },
          },
        ],
      },
      // User cancels in Claude Code CLI, conversation continues
      { role: "user", content: "Never mind, I'll handle it myself." },
    ]

    const result = validateAndCleanupToolConversations(messages)

    // Should remove the abandoned tool_use block to prevent 400 error
    expect(result).toEqual([
      { role: "user", content: "Help me with some code" },
      {
        role: "assistant",
        content: [{ type: "text", text: "I'll help you with that code." }],
      },
      { role: "user", content: "Never mind, I'll handle it myself." },
    ])

    // Verify the specific tool ID is no longer present
    const flatContent = result.flatMap((msg) =>
      Array.isArray(msg.content) ? msg.content : [],
    )
    const toolUseBlocks = flatContent.filter(
      (block) => block.type === "tool_use",
    )
    expect(toolUseBlocks).toHaveLength(0)
  })

  test("should prevent the exact 400 error scenario in a long conversation", () => {
    // Simulates a conversation that reaches message 216 (as in the error) with abandoned tool
    const messages: Array<AnthropicMessage> = []

    // Add many messages to simulate a long conversation
    for (let i = 0; i < 100; i++) {
      messages.push(
        { role: "user", content: `Message ${i * 2 + 1}` },
        { role: "assistant", content: `Response ${i * 2 + 2}` },
      )
    }

    // Add the problematic tool_use scenario in the middle
    messages.push({
      role: "assistant",
      content: [
        { type: "text", text: "Let me use a tool for this." },
        {
          type: "tool_use",
          id: "toolu_vrtx_01GG3T6npgARqCjxkn9Fm9KW",
          name: "problematic_tool",
          input: {},
        },
      ],
    })

    // Continue conversation without tool_result (simulating cancellation)
    for (let i = 0; i < 15; i++) {
      messages.push(
        { role: "user", content: `Later message ${i + 1}` },
        { role: "assistant", content: `Later response ${i + 1}` },
      )
    }

    const result = validateAndCleanupToolConversations(messages)

    // Find the message that had the tool_use
    const problematicMessage = result[200] // The message with tool_use
    expect(problematicMessage.content).toEqual([
      { type: "text", text: "Let me use a tool for this." },
    ])

    // Verify no orphaned tool_use blocks exist
    const allToolUseBlocks = result.flatMap((msg) =>
      Array.isArray(msg.content) ?
        msg.content.filter((block) => block.type === "tool_use")
      : [],
    )
    expect(allToolUseBlocks).toHaveLength(0)
  })
})
