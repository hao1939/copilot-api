import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("responseJsonSchema Handling", () => {
  it("should ignore responseJsonSchema (Gemini-specific, not supported by OpenAI)", () => {
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
              name: "write_todos",
              description: "Write todos",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  todos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                      },
                      required: ["text"],
                    },
                  },
                },
                required: ["todos"],
              },
              responseJsonSchema: {
                // This should be IGNORED - OpenAI doesn't support tool output schemas
                type: "object",
                properties: {
                  todos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    // Verify the tool was translated
    expect(openAIPayload.tools).toHaveLength(1)
    expect(openAIPayload.tools?.[0].function.name).toBe("write_todos")

    // Verify only INPUT parameters are included (not responseJsonSchema)
    const parameters = openAIPayload.tools?.[0].function.parameters as Record<
      string,
      unknown
    >
    expect(parameters).toBeDefined()
    const properties = parameters.properties as { todos: unknown }
    expect(properties.todos).toBeDefined()

    // Verify responseJsonSchema is NOT in the translated output
    const toolFunction = openAIPayload.tools?.[0].function as Record<
      string,
      unknown
    >
    expect(toolFunction.responseJsonSchema).toBeUndefined()
    expect(toolFunction.response_format).toBeUndefined()
  })
})
