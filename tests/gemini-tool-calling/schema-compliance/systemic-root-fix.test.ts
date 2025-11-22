import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Systemic additionalProperties Fix", () => {
  it("should ALWAYS add additionalProperties: false at root level", () => {
    // Test that even if a schema is missing additionalProperties, it's added at the root.
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "test" }],
        },
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: "run_shell_command",
              description: "Run a shell command",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  command: {
                    type: "string",
                    description: "The command to run",
                  },
                  timeout: {
                    type: "integer",
                    description: "Timeout in seconds",
                  },
                },
                required: ["command"],
                // NOTE: Intentionally NOT including additionalProperties
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    const params = openAIPayload.tools?.[0].function.parameters as Record<
      string,
      unknown
    >

    expect(openAIPayload.tools).toHaveLength(1)
    expect(params.additionalProperties).toBe(false)
    const properties = params.properties as { command: { type: string } }
    expect(properties.command.type).toBe("string")
    expect(params.type).toBe("object")
    expect(params.required).toEqual(["command"])
  })
})
