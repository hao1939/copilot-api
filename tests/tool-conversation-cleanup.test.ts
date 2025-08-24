import { describe, test, expect } from "bun:test"

import type { AnthropicMessage } from "~/routes/messages/anthropic-types"

import { validateAndCleanupToolConversations } from "~/routes/messages/tool-conversation-cleanup"

describe("Tool conversation cleanup", () => {
  test("should handle complete tool conversations", () => {
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
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_123",
            content: "Sunny, 75°F",
          },
        ],
      },
    ]

    const result = validateAndCleanupToolConversations(messages)
    expect(result).toEqual(messages) // Should remain unchanged
  })

  test("should NOT remove tool_use blocks at the end of conversation", () => {
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
      // No subsequent user messages - this is valid (tool still pending)
    ]

    const result = validateAndCleanupToolConversations(messages)
    expect(result).toEqual(messages) // Should remain unchanged
  })

  test("should remove abandoned tool_use blocks when user continues without providing tool_result", () => {
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
      // User continues conversation without providing tool_result - indicates cancellation
      { role: "user", content: "Actually, never mind." },
    ]

    const result = validateAndCleanupToolConversations(messages)

    // Should remove the abandoned tool_use block
    expect(result).toEqual([
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: [{ type: "text", text: "I'll check the weather for you." }],
      },
      { role: "user", content: "Actually, never mind." },
    ])
  })

  test("should handle multiple abandoned tool_use blocks", () => {
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "Get me weather and time" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll get both for you." },
          {
            type: "tool_use",
            id: "call_123",
            name: "get_weather",
            input: { location: "Boston" },
          },
          {
            type: "tool_use",
            id: "call_456",
            name: "get_time",
            input: {},
          },
        ],
      },
      // User abandons the tool calls
      { role: "user", content: "Cancel that." },
    ]

    const result = validateAndCleanupToolConversations(messages)

    // Should remove both abandoned tool_use blocks
    expect(result).toEqual([
      { role: "user", content: "Get me weather and time" },
      {
        role: "assistant",
        content: [{ type: "text", text: "I'll get both for you." }],
      },
      { role: "user", content: "Cancel that." },
    ])
  })

  test("should handle partial completion (some tool_results provided)", () => {
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "Get weather and time" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call_123",
            name: "get_weather",
            input: { location: "Boston" },
          },
          {
            type: "tool_use",
            id: "call_456",
            name: "get_time",
            input: {},
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_123",
            content: "Sunny, 75°F",
          },
          // Missing tool_result for call_456, but user continues
        ],
      },
      { role: "user", content: "That's enough." },
    ]

    const result = validateAndCleanupToolConversations(messages)

    // Should remove the abandoned tool_use block for call_456
    expect(result).toEqual([
      { role: "user", content: "Get weather and time" },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call_123",
            name: "get_weather",
            input: { location: "Boston" },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_123",
            content: "Sunny, 75°F",
          },
        ],
      },
      { role: "user", content: "That's enough." },
    ])
  })

  test("should handle empty content arrays gracefully", () => {
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: [] },
      { role: "assistant", content: [] },
    ]

    const result = validateAndCleanupToolConversations(messages)
    expect(result).toEqual(messages)
  })

  test("should handle string content gracefully", () => {
    const messages: Array<AnthropicMessage> = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ]

    const result = validateAndCleanupToolConversations(messages)
    expect(result).toEqual(messages)
  })
})
