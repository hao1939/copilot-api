import { describe, test, expect } from "bun:test"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { translateToOpenAI } from "~/routes/messages/non-stream-translation"

describe("Tool conversation cleanup integration", () => {
  test("should fix the Claude Code CLI cancellation scenario", () => {
    // This simulates the scenario described in the issue where
    // Claude Code CLI cancels a tool call, leaving incomplete tool_use blocks
    const anthropicPayload: AnthropicMessagesPayload = {
      model: "claude-3-5-sonnet-20241022",
      messages: [
        { role: "user", content: "What's the weather like in Boston?" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll check the weather for you." },
            {
              type: "tool_use",
              id: "toolu_vrtx_01GG3T6npgARqCjxkn9Fm9KW", // This ID matches the error message
              name: "get_weather",
              input: { location: "Boston, MA" },
            },
          ],
        },
        // User cancels or continues without providing tool_result
        // This would normally cause the 400 error mentioned in the issue
        { role: "user", content: "Actually, never mind the weather." },
      ],
      max_tokens: 100,
    }

    // Before the fix, this would create a payload that would be rejected by Anthropic API
    // with: "tool_use ids were found without tool_result blocks immediately after"
    const openAIPayload = translateToOpenAI(anthropicPayload)

    // After the fix, the abandoned tool_use block should be removed
    const assistantMessage = openAIPayload.messages.find(
      (m) => m.role === "assistant",
    )

    expect(assistantMessage).toBeDefined()
    expect(assistantMessage?.content).toBe("I'll check the weather for you.")
    expect(assistantMessage?.tool_calls).toBeUndefined()

    // The payload should be valid and not cause 400 errors
    expect(openAIPayload.messages).toHaveLength(3)
    expect(openAIPayload.messages[0].role).toBe("user")
    expect(openAIPayload.messages[1].role).toBe("assistant")
    expect(openAIPayload.messages[2].role).toBe("user")
  })

  test("should preserve valid tool calls at the end of conversation", () => {
    // This is a valid scenario where tool_use is at the end and still pending
    const anthropicPayload: AnthropicMessagesPayload = {
      model: "claude-3-5-sonnet-20241022",
      messages: [
        { role: "user", content: "What's the weather like in Boston?" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll check the weather for you." },
            {
              type: "tool_use",
              id: "toolu_vrtx_01GG3T6npgARqCjxkn9Fm9KW",
              name: "get_weather",
              input: { location: "Boston, MA" },
            },
          ],
        },
        // No subsequent user message - tool call is still pending
      ],
      max_tokens: 100,
    }

    const openAIPayload = translateToOpenAI(anthropicPayload)

    // Should preserve the tool call since it's not abandoned
    const assistantMessage = openAIPayload.messages.find(
      (m) => m.role === "assistant",
    )

    expect(assistantMessage).toBeDefined()
    expect(assistantMessage?.content).toBe("I'll check the weather for you.")
    expect(assistantMessage?.tool_calls).toHaveLength(1)
    expect(assistantMessage?.tool_calls?.[0].function.name).toBe("get_weather")
  })

  test("should handle mixed scenarios with some completed and some abandoned tool calls", () => {
    const anthropicPayload: AnthropicMessagesPayload = {
      model: "claude-3-5-sonnet-20241022",
      messages: [
        { role: "user", content: "Get me weather and time info" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "call_weather",
              name: "get_weather",
              input: { location: "Boston" },
            },
            {
              type: "tool_use",
              id: "call_time",
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
              tool_use_id: "call_weather",
              content: "Sunny, 75°F",
            },
            // Missing tool_result for call_time
          ],
        },
        { role: "user", content: "Thanks, that's enough." },
      ],
      max_tokens: 100,
    }

    const openAIPayload = translateToOpenAI(anthropicPayload)

    // Should keep the completed weather call, remove the abandoned time call
    const assistantMessage = openAIPayload.messages.find(
      (m) => m.role === "assistant",
    )

    expect(assistantMessage).toBeDefined()
    expect(assistantMessage?.tool_calls).toHaveLength(1)
    expect(assistantMessage?.tool_calls?.[0].function.name).toBe("get_weather")

    // Should have tool message for the completed call
    const toolMessage = openAIPayload.messages.find((m) => m.role === "tool")
    expect(toolMessage).toBeDefined()
    expect(toolMessage?.tool_call_id).toBe("call_weather")
    expect(toolMessage?.content).toBe("Sunny, 75°F")
  })
})
