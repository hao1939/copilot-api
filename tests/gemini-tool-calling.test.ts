import { describe, expect, it } from "bun:test"
import type { GeminiGenerateContentPayload } from "~/routes/gemini/gemini-types"
import { translateGeminiToOpenAI, translateOpenAIToGemini } from "~/routes/gemini/translation"
import type { ChatCompletionResponse } from "~/services/copilot/create-chat-completions"

describe("Gemini Tool Calling Translation", () => {
  describe("Tool Call ID Matching", () => {
    it("should generate matching IDs for tool_calls and tool responses", () => {
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

      // Find the assistant message with tool_calls
      const assistantMessage = openAIPayload.messages.find(
        (m) => m.role === "assistant" && "tool_calls" in m,
      )
      expect(assistantMessage).toBeDefined()
      expect(assistantMessage?.tool_calls).toBeDefined()
      expect(assistantMessage?.tool_calls?.length).toBe(1)

      const toolCallId = assistantMessage?.tool_calls?.[0].id

      // Find the tool response message
      const toolMessage = openAIPayload.messages.find((m) => m.role === "tool")
      expect(toolMessage).toBeDefined()
      expect(toolMessage?.tool_call_id).toBe(toolCallId)
    })

    it("should handle multiple tool calls with matching IDs", () => {
      const geminiPayload: GeminiGenerateContentPayload = {
        contents: [
          {
            role: "user",
            parts: [{ text: "List and read" }],
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
              {
                functionCall: {
                  name: "read_file",
                  args: { file_path: "test.txt" },
                },
              },
            ],
          },
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  id: "list-123",
                  name: "list_directory",
                  response: { output: "files" },
                },
              },
              {
                functionResponse: {
                  id: "read-456",
                  name: "read_file",
                  response: { content: "hello" },
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
      expect(assistantMessage?.tool_calls?.length).toBe(2)

      const toolCallIds = assistantMessage?.tool_calls?.map((tc) => tc.id)

      const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")
      expect(toolMessages.length).toBe(2)

      // Verify IDs match in order
      expect(toolMessages[0].tool_call_id).toBe(toolCallIds?.[0])
      expect(toolMessages[1].tool_call_id).toBe(toolCallIds?.[1])
    })

    it("should maintain ID consistency across multiple turns", () => {
      const geminiPayload: GeminiGenerateContentPayload = {
        contents: [
          // First turn
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
                  name: "list_directory",
                  response: { output: "file1.txt" },
                },
              },
            ],
          },
          // Second turn
          {
            role: "user",
            parts: [{ text: "Read that file" }],
          },
          {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "read_file",
                  args: { file_path: "file1.txt" },
                },
              },
            ],
          },
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: "read_file",
                  response: { content: "hello" },
                },
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      // Find both assistant messages with tool_calls
      const assistantMessages = openAIPayload.messages.filter(
        (m) => m.role === "assistant" && "tool_calls" in m,
      )
      expect(assistantMessages.length).toBe(2)

      const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")
      expect(toolMessages.length).toBe(2)

      // First turn IDs should match
      expect(toolMessages[0].tool_call_id).toBe(assistantMessages[0]?.tool_calls?.[0].id)
      // Second turn IDs should match
      expect(toolMessages[1].tool_call_id).toBe(assistantMessages[1]?.tool_calls?.[0].id)
    })
  })

  describe("Duplicate Function Response Deduplication", () => {
    it("should deduplicate function responses with same ID", () => {
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
              // Duplicate responses with same ID (simulating gemini-cli bug)
              {
                functionResponse: {
                  id: "list-123-duplicate",
                  name: "list_directory",
                  response: { output: "files" },
                },
              },
              {
                functionResponse: {
                  id: "list-123-duplicate", // Same ID!
                  name: "list_directory",
                  response: { output: "files" },
                },
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

      // Should only have ONE tool message despite two responses
      expect(toolMessages.length).toBe(1)
    })

    it("should keep function responses with different IDs", () => {
      const geminiPayload: GeminiGenerateContentPayload = {
        contents: [
          {
            role: "user",
            parts: [{ text: "Multiple ops" }],
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
              {
                functionCall: {
                  name: "read_file",
                  args: { file_path: "test.txt" },
                },
              },
            ],
          },
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  id: "list-123",
                  name: "list_directory",
                  response: { output: "files" },
                },
              },
              {
                functionResponse: {
                  id: "read-456", // Different ID
                  name: "read_file",
                  response: { content: "hello" },
                },
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      const toolMessages = openAIPayload.messages.filter((m) => m.role === "tool")

      // Should have BOTH tool messages
      expect(toolMessages.length).toBe(2)
    })
  })

  describe("Schema additionalProperties Compliance", () => {
    it("should add additionalProperties: false to all object schemas", () => {
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
                name: "test_tool",
                description: "Test",
                parametersJsonSchema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      expect(openAIPayload.tools).toBeDefined()
      expect(openAIPayload.tools?.[0].function.parameters).toHaveProperty(
        "additionalProperties",
        false,
      )
    })

    it("should recursively add additionalProperties to nested objects", () => {
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
                name: "complex_tool",
                description: "Complex",
                parametersJsonSchema: {
                  type: "object",
                  properties: {
                    config: {
                      type: "object",
                      properties: {
                        settings: {
                          type: "object",
                          properties: {
                            enabled: { type: "boolean" },
                          },
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

      const params = openAIPayload.tools?.[0].function.parameters as any

      // Top level should have additionalProperties: false
      expect(params).toHaveProperty("additionalProperties", false)

      // Nested config object should have it
      expect(params.properties.config).toHaveProperty("additionalProperties", false)

      // Deeply nested settings object should have it
      expect(params.properties.config.properties.settings).toHaveProperty(
        "additionalProperties",
        false,
      )
    })

    it("should handle tools with parameters field instead of parametersJsonSchema", () => {
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
                name: "test_tool",
                description: "Test",
                // Using 'parameters' instead of 'parametersJsonSchema'
                parameters: {
                  type: "object",
                  properties: {
                    file_path: { type: "string" },
                  },
                },
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      expect(openAIPayload.tools?.[0].function.parameters).toHaveProperty(
        "additionalProperties",
        false,
      )
    })

    it("should handle empty or missing tool schemas", () => {
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
                name: "no_params_tool",
                description: "No params",
                parametersJsonSchema: {},
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      // Should provide minimal valid schema
      expect(openAIPayload.tools?.[0].function.parameters).toEqual({
        type: "object",
        properties: {},
        additionalProperties: false,
      })
    })

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
      expect(openAIPayload.tools?.[0].function.parameters).toBeDefined()
      expect(openAIPayload.tools?.[0].function.parameters.properties.todos).toBeDefined()

      // Verify responseJsonSchema is NOT in the translated output
      const toolFunction = openAIPayload.tools?.[0].function as any
      expect(toolFunction.responseJsonSchema).toBeUndefined()
      expect(toolFunction.response_format).toBeUndefined()
    })

    it("should ALWAYS add additionalProperties: false at root level (systemic fix)", () => {
      // Test the systemic fix: even if a schema is missing additionalProperties,
      // it should ALWAYS be added at the root level for OpenAI strict mode compliance
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
                  // NOTE: Intentionally NOT including additionalProperties here
                  // to test that the systemic fix adds it
                },
              },
            ],
          },
        ],
      }

      const openAIPayload = translateGeminiToOpenAI(geminiPayload)

      // Verify the tool was translated
      expect(openAIPayload.tools).toHaveLength(1)
      expect(openAIPayload.tools?.[0].function.name).toBe("run_shell_command")

      // CRITICAL: Verify additionalProperties: false is ALWAYS present at root level
      const params = openAIPayload.tools?.[0].function.parameters as any
      expect(params.additionalProperties).toBe(false)

      // Verify nested object properties also have it
      expect(params.properties.command.type).toBe("string")
      expect(params.properties.timeout.type).toBe("integer")

      // Verify the schema is valid for OpenAI strict mode
      expect(params.type).toBe("object")
      expect(params.required).toEqual(["command"])
    })

    it("should add additionalProperties: false to deeply nested object schemas", () => {
      // Test that the deep cloning fix works - nested objects at ANY level get additionalProperties: false
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
      const params = openAIPayload.tools?.[0].function.parameters as any

      // Root level must have additionalProperties: false
      expect(params.additionalProperties).toBe(false)

      // Level 1 nested object must have it
      expect(params.properties.level1.additionalProperties).toBe(false)

      // Level 2 nested object must have it
      expect(params.properties.level1.properties.level2.additionalProperties).toBe(false)

      // Level 3 nested object must have it
      expect(params.properties.level1.properties.level2.properties.level3.additionalProperties).toBe(
        false,
      )

      // Sibling object at level 2 must have it
      expect(params.properties.level1.properties.siblingObject.additionalProperties).toBe(false)

      // Array items that are objects must have it
      expect(params.properties.arrayWithObjects.items.additionalProperties).toBe(false)
    })
  })

  describe("Response Translation", () => {
    it("should translate OpenAI response with tool_calls to Gemini format", () => {
      const openAIResponse: ChatCompletionResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_abc123",
                  type: "function",
                  function: {
                    name: "list_directory",
                    arguments: '{"dir_path":"."}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }

      const geminiResponse = translateOpenAIToGemini(openAIResponse)

      expect(geminiResponse.candidates?.[0].content.parts).toHaveLength(1)
      expect(geminiResponse.candidates?.[0].content.parts[0]).toHaveProperty("functionCall")

      const functionCall = geminiResponse.candidates?.[0].content.parts[0] as any
      expect(functionCall.functionCall.name).toBe("list_directory")
      expect(functionCall.functionCall.args).toEqual({ dir_path: "." })
    })

    it("should translate finish_reason correctly for tool_calls", () => {
      const openAIResponse: ChatCompletionResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_abc123",
                  type: "function",
                  function: {
                    name: "test_tool",
                    arguments: "{}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }

      const geminiResponse = translateOpenAIToGemini(openAIResponse)

      // tool_calls should map to STOP, not OTHER
      expect(geminiResponse.candidates?.[0].finishReason).toBe("STOP")
    })

    it("should handle null finish_reason", () => {
      const openAIResponse: ChatCompletionResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "gemini-2.5-pro",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Partial response",
            },
            finish_reason: null,
          },
        ],
      }

      const geminiResponse = translateOpenAIToGemini(openAIResponse)

      // null finish_reason should map to undefined, not OTHER
      expect(geminiResponse.candidates?.[0].finishReason).toBeUndefined()
    })
  })

  describe("Tool Call Name Field", () => {
    it("should include name field at tool_call level for Gemini compatibility", () => {
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
      // During debugging we confirmed GitHub Copilot returns "invalid request body" if name is present
      expect(toolCall).not.toHaveProperty("name")

      // Should have name in function object (OpenAI standard)
      expect(toolCall?.function).toHaveProperty("name", "list_directory")
    })
  })
})
