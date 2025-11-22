import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("JSON Schema Mode Translation", () => {
  it("should translate responseSchema to json_schema mode", () => {
    const geminiPayload: GeminiGenerateContentPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Create a person" }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Person's name",
            },
            age: {
              type: "integer",
              description: "Person's age",
            },
          },
          required: ["name", "age"],
        },
      },
    }

    const openAIPayload = translateGeminiToOpenAI(geminiPayload)

    expect(openAIPayload.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "gemini_response_schema",
        strict: true,
      },
    })

    const schema = (
      openAIPayload.response_format as {
        json_schema: { schema: Record<string, unknown> }
      }
    ).json_schema.schema
    expect(schema).toBeDefined()
    expect(schema.type).toBe("object")
    expect(schema.additionalProperties).toBe(false)

    // Integer types should be preserved (GitHub Copilot accepts them)
    const properties = schema.properties as { age: { type: string } }
    expect(properties.age.type).toBe("integer")
  })
})
