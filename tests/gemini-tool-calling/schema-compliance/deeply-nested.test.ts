import { describe, expect, it } from "bun:test"

import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"

import { translateGeminiToOpenAI } from "~/routes/gemini/translation"

describe("Deeply Nested Schema Compliance", () => {
  describe("should add additionalProperties: false to deeply nested object schemas", () => {
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
              name: "complex_nested_tool",
              description: "Tool with deeply nested object schemas",
              parametersJsonSchema: {
                type: "object",
                properties: {
                  level1: {
                    type: "object",
                    properties: {
                      level2: {
                        type: "object",
                        properties: {
                          level3: {
                            type: "object",
                            properties: {
                              deepValue: {
                                type: "string",
                              },
                            },
                          },
                        },
                      },
                      siblingObject: {
                        type: "object",
                        properties: {
                          value: { type: "number" },
                        },
                      },
                    },
                  },
                  arrayWithObjects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        itemProp: { type: "string" },
                      },
                    },
                  },
                },
                required: ["level1"],
                // NOTE: Intentionally NOT including additionalProperties anywhere
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

    it("should add additionalProperties: false to the root-level object", () => {
      // Root level must have additionalProperties: false
      expect(params.additionalProperties).toBe(false)
    })

    it("should add additionalProperties: false to a level-1 nested object", () => {
      // Level 1 nested object must have it
      const properties = params.properties as {
        level1: { additionalProperties: boolean }
      }
      expect(properties.level1.additionalProperties).toBe(false)
    })

    it("should add additionalProperties: false to a level-2 nested object", () => {
      // Level 2 nested object must have it
      const properties = params.properties as {
        level1: { properties: { level2: { additionalProperties: boolean } } }
      }
      expect(properties.level1.properties.level2.additionalProperties).toBe(
        false,
      )
    })

    it("should add additionalProperties: false to a level-3 nested object", () => {
      // Level 3 nested object must have it
      const properties = params.properties as {
        level1: {
          properties: {
            level2: {
              properties: { level3: { additionalProperties: boolean } }
            }
          }
        }
      }
      expect(
        properties.level1.properties.level2.properties.level3
          .additionalProperties,
      ).toBe(false)
    })

    it("should add additionalProperties: false to a sibling object at level 2", () => {
      // Sibling object at level 2 must have it
      const properties = params.properties as {
        level1: {
          properties: { siblingObject: { additionalProperties: boolean } }
        }
      }
      expect(
        properties.level1.properties.siblingObject.additionalProperties,
      ).toBe(false)
    })

    it("should add additionalProperties: false to array items that are objects", () => {
      // Array items that are objects must have it
      const properties = params.properties as {
        arrayWithObjects: { items: { additionalProperties: boolean } }
      }
      expect(properties.arrayWithObjects.items.additionalProperties).toBe(false)
    })
  })
})
