import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Tool Call and Response Compatibility", () => {
  it("should not include name field at tool_call level for OpenAI compatibility", () => {
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
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    const assistantMessage = openAIPayload.messages.find(
      (m) => m.role === "assistant" && "tool_calls" in m,
    )

    const toolCall = assistantMessage?.tool_calls?.[0]

    // Should NOT have name at tool_call level (GitHub Copilot rejects this field)
    expect(toolCall).not.toHaveProperty("name")

    // Should have name in function object (OpenAI standard)
    expect(toolCall?.function).toHaveProperty("name", "list_directory")
  })

  it("should include name field in tool messages for GitHub Copilot compatibility", () => {
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

    // Find the tool response message
    const toolMessage = openAIPayload.messages.find((m) => m.role === "tool")
    expect(toolMessage).toBeDefined()

    // GitHub Copilot requires the name field for tool messages
    expect(toolMessage).toHaveProperty("name", "list_directory")
    if (toolMessage) {
      expect(toolMessage.tool_call_id).toBeDefined()
    }
  })
})
