# Comprehensive Test Plan for Gemini API Translation

This document outlines a complete testing strategy for the Gemini API ↔ OpenAI API translation layer.

## Test Categories

### 1. Unit Tests (Already Implemented)
### 2. Integration Tests (To Add)
### 3. Edge Case Tests (To Add)
### 4. Performance Tests (To Add)
### 5. Compatibility Tests (To Add)

---

## 1. Unit Tests (Existing - 59 tests passing)

### Schema Validator Tests (`gemini-schema-validator.test.ts`)
**Status**: ✅ 17 tests passing

#### Covered:
- ✅ Valid object schema with additionalProperties
- ✅ Reject object without additionalProperties
- ✅ Reject object without properties field
- ✅ Reject array without items
- ✅ Accept valid array with items
- ✅ Reject nullable field
- ✅ Reject $ref
- ✅ Validate nested objects
- ✅ Reject nested object without additionalProperties
- ✅ Reject required field not in properties
- ✅ Reject null values in schema
- ✅ Validate multiple tools
- ✅ Format validation errors
- ✅ Tool type validation
- ✅ Tool name validation

### Translation Tests (`gemini-translation.test.ts`)
**Coverage needed**:
- ✅ Basic request translation (existing)
- ✅ Response translation (existing)
- 📝 Need to add: All 12 feature mappings as unit tests

### Tool Calling Tests (`gemini-tool-calling.test.ts`)
**Coverage**:
- ✅ Tool definition translation
- ✅ Function call translation
- ✅ Function response translation
- ✅ Tool call ID generation
- ✅ Deduplication of function responses

### Response Format Tests (`gemini-response-format.test.ts`)
**Coverage**:
- ✅ JSON mode translation
- ✅ Schema mode translation
- ✅ additionalProperties injection

---

## 2. Integration Tests (To Add)

### 2.1 End-to-End Feature Tests

Create a new test file: `tests/gemini-e2e.test.ts`

```typescript
describe("Gemini E2E Tests", () => {
  describe("Feature 1: Simple Text Generation", () => {
    it("should handle basic text request via Gemini endpoint", async () => {
      const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
        method: "POST",
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{text: "Say hello"}]
          }]
        })
      })

      const data = await response.json()
      expect(data.candidates).toBeDefined()
      expect(data.candidates[0].content.parts[0].text).toBeTruthy()
    })
  })

  describe("Feature 2: System Instructions", () => {
    it("should translate systemInstruction to system message", async () => {
      const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
        method: "POST",
        body: JSON.stringify({
          systemInstruction: {
            parts: [{text: "You are a helpful assistant that responds in French"}]
          },
          contents: [{
            role: "user",
            parts: [{text: "Say hello"}]
          }]
        })
      })

      const data = await response.json()
      const text = data.candidates[0].content.parts[0].text
      // Should respond in French
      expect(text.toLowerCase()).toMatch(/bonjour|salut/)
    })
  })

  describe("Feature 7: Function Calling", () => {
    it("should translate function declarations to OpenAI tools", async () => {
      const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
        method: "POST",
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{text: "What's the weather in San Francisco?"}]
          }],
          tools: [{
            functionDeclarations: [{
              name: "get_weather",
              description: "Get weather",
              parameters: {
                type: "object",
                properties: {
                  location: {type: "string"}
                },
                required: ["location"]
              }
            }]
          }]
        })
      })

      const data = await response.json()
      const parts = data.candidates[0].content.parts
      const functionCall = parts.find(p => p.functionCall)

      expect(functionCall).toBeDefined()
      expect(functionCall.functionCall.name).toBe("get_weather")
      expect(functionCall.functionCall.args.location).toBeTruthy()
    })
  })

  describe("Feature 9: Function Response", () => {
    it("should handle complete function call round-trip", async () => {
      const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
        method: "POST",
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{text: "What's the weather in Tokyo?"}]
            },
            {
              role: "model",
              parts: [{
                functionCall: {
                  name: "get_weather",
                  args: {location: "Tokyo"}
                }
              }]
            },
            {
              role: "user",
              parts: [{
                functionResponse: {
                  name: "get_weather",
                  response: {temperature: 22, condition: "sunny"}
                }
              }]
            }
          ],
          tools: [{
            functionDeclarations: [{
              name: "get_weather",
              description: "Get weather",
              parameters: {
                type: "object",
                properties: {
                  location: {type: "string"}
                },
                required: ["location"]
              }
            }]
          }]
        })
      })

      const data = await response.json()
      const text = data.candidates[0].content.parts[0].text

      // Should incorporate the weather data
      expect(text.toLowerCase()).toMatch(/tokyo|22|sunny/)
    })
  })

  describe("Feature 12: Nested Objects", () => {
    it("should add additionalProperties to all nested levels", async () => {
      const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
        method: "POST",
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{text: "Create a user named John, age 30, in New York"}]
          }],
          tools: [{
            functionDeclarations: [{
              name: "create_user",
              parameters: {
                type: "object",
                properties: {
                  name: {type: "string"},
                  profile: {
                    type: "object",
                    properties: {
                      age: {type: "number"},
                      address: {
                        type: "object",
                        properties: {
                          city: {type: "string"}
                        }
                      }
                    }
                  }
                }
              }
            }]
          }]
        })
      })

      const data = await response.json()
      const functionCall = data.candidates[0].content.parts[0].functionCall

      expect(functionCall.name).toBe("create_user")
      expect(functionCall.args.name).toBeTruthy()
      expect(functionCall.args.profile.age).toBeTruthy()
      expect(functionCall.args.profile.address.city).toBeTruthy()
    })
  })
})
```

---

## 3. Edge Case Tests (To Add)

### 3.1 Schema Edge Cases

Create: `tests/gemini-schema-edge-cases.test.ts`

```typescript
describe("Schema Edge Cases", () => {
  it("should handle empty parameters object", () => {
    const tools = [{
      type: "function",
      function: {
        name: "no_params",
        parameters: {}
      }
    }]

    const translated = translateGeminiToolsToOpenAI(...)
    expect(translated[0].function.parameters).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false
    })
  })

  it("should handle undefined parameters", () => {
    const tools = [{
      type: "function",
      function: {
        name: "no_params"
        // parameters missing
      }
    }]

    const translated = translateGeminiToolsToOpenAI(...)
    expect(translated[0].function.parameters).toBeDefined()
  })

  it("should handle deeply nested objects (5+ levels)", () => {
    const schema = {
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
                    level4: {
                      type: "object",
                      properties: {
                        level5: {
                          type: "string"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const processed = addAdditionalPropertiesFalse(schema)

    // Check all levels have additionalProperties: false
    expect(processed.additionalProperties).toBe(false)
    expect(processed.properties.level1.additionalProperties).toBe(false)
    expect(processed.properties.level1.properties.level2.additionalProperties).toBe(false)
    // ... check all 5 levels
  })

  it("should handle arrays of objects", () => {
    const schema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {type: "string"}
            }
          }
        }
      }
    }

    const processed = addAdditionalPropertiesFalse(schema)
    expect(processed.properties.items.items.additionalProperties).toBe(false)
  })

  it("should handle mixed property types", () => {
    const schema = {
      type: "object",
      properties: {
        str: {type: "string"},
        num: {type: "number"},
        bool: {type: "boolean"},
        arr: {type: "array", items: {type: "string"}},
        obj: {type: "object", properties: {}}
      }
    }

    const processed = addAdditionalPropertiesFalse(schema)
    expect(processed.properties.obj.additionalProperties).toBe(false)
    expect(processed.properties.arr.additionalProperties).toBeUndefined()
  })

  it("should handle enums", () => {
    const schema = {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive", "pending"]
        }
      }
    }

    const processed = addAdditionalPropertiesFalse(schema)
    expect(processed.properties.status.enum).toEqual(["active", "inactive", "pending"])
  })
})
```

### 3.2 Translation Edge Cases

Create: `tests/gemini-translation-edge-cases.test.ts`

```typescript
describe("Translation Edge Cases", () => {
  it("should handle empty contents array", () => {
    const payload = {
      contents: []
    }

    expect(() => translateGeminiToOpenAI(payload)).not.toThrow()
  })

  it("should handle mixed text and function calls in same message", () => {
    const contents = [{
      role: "model",
      parts: [
        {text: "Let me check the weather"},
        {functionCall: {name: "get_weather", args: {location: "Tokyo"}}}
      ]
    }]

    const messages = translateGeminiContentsToOpenAI(contents)
    expect(messages[0].content).toBeTruthy()
    expect(messages[0].tool_calls).toBeDefined()
  })

  it("should handle multiple function calls in single turn", () => {
    const contents = [{
      role: "model",
      parts: [
        {functionCall: {name: "get_weather", args: {location: "Tokyo"}}},
        {functionCall: {name: "get_weather", args: {location: "NYC"}}}
      ]
    }]

    const messages = translateGeminiContentsToOpenAI(contents)
    expect(messages[0].tool_calls).toHaveLength(2)
    expect(messages[0].tool_calls[0].id).not.toBe(messages[0].tool_calls[1].id)
  })

  it("should deduplicate function responses with same ID", () => {
    const contents = [{
      role: "user",
      parts: [
        {functionResponse: {id: "call_123", name: "tool", response: {a: 1}}},
        {functionResponse: {id: "call_123", name: "tool", response: {a: 1}}}  // Duplicate
      ]
    }]

    const messages = translateGeminiContentsToOpenAI(contents)
    // Should only create 1 tool message, not 2
    expect(messages.filter(m => m.role === "tool")).toHaveLength(1)
  })

  it("should handle empty parts array", () => {
    const contents = [{
      role: "user",
      parts: []
    }]

    const messages = translateGeminiContentsToOpenAI(contents)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe("")
  })

  it("should handle very long conversation history (100+ turns)", () => {
    const contents = []
    for (let i = 0; i < 100; i++) {
      contents.push({role: "user", parts: [{text: `Message ${i}`}]})
      contents.push({role: "model", parts: [{text: `Response ${i}`}]})
    }

    const messages = translateGeminiContentsToOpenAI(contents)
    expect(messages).toHaveLength(200)
  })
})
```

---

## 4. Performance Tests (To Add)

Create: `tests/gemini-performance.test.ts`

```typescript
describe("Performance Tests", () => {
  it("should translate large schema in under 100ms", () => {
    // Create schema with 50 nested properties
    const largeSchema = {
      type: "object",
      properties: {}
    }
    for (let i = 0; i < 50; i++) {
      largeSchema.properties[`field${i}`] = {
        type: "object",
        properties: {
          nested1: {type: "string"},
          nested2: {type: "number"}
        }
      }
    }

    const start = Date.now()
    const processed = addAdditionalPropertiesFalse(largeSchema)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(100)
    expect(processed.properties.field0.additionalProperties).toBe(false)
  })

  it("should handle 1000 tools without memory issues", () => {
    const tools = []
    for (let i = 0; i < 1000; i++) {
      tools.push({
        functionDeclarations: [{
          name: `tool_${i}`,
          parameters: {
            type: "object",
            properties: {
              param: {type: "string"}
            }
          }
        }]
      })
    }

    const memBefore = process.memoryUsage().heapUsed
    const translated = translateGeminiToolsToOpenAI(tools)
    const memAfter = process.memoryUsage().heapUsed

    expect(translated).toHaveLength(1000)
    // Memory increase should be reasonable (< 50MB)
    expect(memAfter - memBefore).toBeLessThan(50 * 1024 * 1024)
  })

  it("should validate 100 tools in under 500ms", () => {
    const tools = Array(100).fill({
      type: "function",
      function: {
        name: "test",
        parameters: {
          type: "object",
          properties: {a: {type: "string"}},
          required: ["a"],
          additionalProperties: false
        },
        strict: true
      }
    })

    const start = Date.now()
    const result = validateToolsForStrictMode(tools)
    const duration = Date.now() - start

    expect(result.valid).toBe(true)
    expect(duration).toBeLessThan(500)
  })
})
```

---

## 5. Compatibility Tests (To Add)

### 5.1 Model Compatibility

Create: `tests/gemini-model-compatibility.test.ts`

```typescript
describe("Model Compatibility", () => {
  const models = [
    "gemini-2.5-pro",
    "gemini-3-pro-preview",
    "gpt-4",
    "gpt-4o",
    "claude-sonnet-4"
  ]

  models.forEach(model => {
    it(`should work with model: ${model}`, async () => {
      const response = await fetch(`/v1beta/models/${model}:generateContent`, {
        method: "POST",
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{text: "Hello"}]
          }]
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.candidates).toBeDefined()
    })
  })
})
```

### 5.2 Streaming Compatibility

Create: `tests/gemini-streaming.test.ts`

```typescript
describe("Streaming Tests", () => {
  it("should stream text responses", async () => {
    const response = await fetch("/v1beta/models/gemini-2.5-pro:streamGenerateContent", {
      method: "POST",
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{text: "Count to 5"}]
        }]
      })
    })

    expect(response.headers.get("content-type")).toContain("text/event-stream")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let chunks = []
    while (true) {
      const {done, value} = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.some(c => c.includes("data:"))).toBe(true)
  })

  it("should stream function calls", async () => {
    const response = await fetch("/v1beta/models/gemini-2.5-pro:streamGenerateContent", {
      method: "POST",
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{text: "What's the weather?"}]
        }],
        tools: [{
          functionDeclarations: [{
            name: "get_weather",
            parameters: {
              type: "object",
              properties: {
                location: {type: "string"}
              },
              required: ["location"]
            }
          }]
        }]
      })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let functionCallSeen = false
    while (true) {
      const {done, value} = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      if (chunk.includes("functionCall")) {
        functionCallSeen = true
      }
    }

    expect(functionCallSeen).toBe(true)
  })
})
```

---

## 6. Error Handling Tests (To Add)

Create: `tests/gemini-error-handling.test.ts`

```typescript
describe("Error Handling", () => {
  it("should return clear error for invalid tool schema", async () => {
    const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      body: JSON.stringify({
        contents: [{role: "user", parts: [{text: "Hello"}]}],
        tools: [{
          functionDeclarations: [{
            name: "bad_tool",
            parameters: {
              type: "object"
              // Missing properties and additionalProperties
            }
          }]
        }]
      })
    })

    expect(response.status).toBe(400)
    const error = await response.json()
    expect(error.error.message).toContain("additionalProperties")
  })

  it("should handle missing required fields gracefully", async () => {
    const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      body: JSON.stringify({
        // Missing contents
      })
    })

    expect(response.status).toBe(400)
  })

  it("should handle malformed JSON", async () => {
    const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      body: "invalid json{"
    })

    expect(response.status).toBe(400)
  })

  it("should validate tool names", async () => {
    const response = await fetch("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      body: JSON.stringify({
        contents: [{role: "user", parts: [{text: "Hello"}]}],
        tools: [{
          functionDeclarations: [{
            // Missing name
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          }]
        }]
      })
    })

    expect(response.status).toBe(400)
    const error = await response.json()
    expect(error.error.message).toContain("name")
  })
})
```

---

## 7. Regression Tests (To Add)

Create: `tests/gemini-regression.test.ts`

```typescript
describe("Regression Tests", () => {
  it("should not mutate original schema (shallow copy bug)", () => {
    const originalSchema = {
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: {
            value: {type: "string"}
          }
        }
      }
    }

    const originalCopy = JSON.parse(JSON.stringify(originalSchema))
    const processed = addAdditionalPropertiesFalse(originalSchema)

    // Original should not be modified
    expect(originalSchema).toEqual(originalCopy)
    expect(originalSchema.additionalProperties).toBeUndefined()
    expect(processed.additionalProperties).toBe(false)
  })

  it("should not lose enum values during deep clone", () => {
    const schema = {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive"]
        }
      }
    }

    const processed = addAdditionalPropertiesFalse(schema)
    expect(processed.properties.status.enum).toEqual(["active", "inactive"])
  })

  it("should handle duplicate functionResponse IDs (gemini-cli bug)", () => {
    const contents = [{
      role: "user",
      parts: [
        {functionResponse: {id: "1", name: "tool", response: {}}},
        {functionResponse: {id: "1", name: "tool", response: {}}}  // Duplicate
      ]
    }]

    const messages = translateGeminiContentsToOpenAI(contents)
    // Should only create 1 tool message
    expect(messages).toHaveLength(1)
  })
})
```

---

## Test Execution Plan

### Phase 1: Complete Unit Tests ✅
- [x] Schema validator tests (17 tests)
- [x] Translation tests (basic)
- [x] Tool calling tests
- [x] Response format tests
- **Status**: 59 tests passing

### Phase 2: Add Integration Tests 📝
- [ ] End-to-end feature tests (12 features × ~2 tests = 24 tests)
- [ ] Streaming tests
- [ ] Model compatibility tests
- **Target**: 90 total tests

### Phase 3: Add Edge Case Tests 📝
- [ ] Schema edge cases (10 tests)
- [ ] Translation edge cases (10 tests)
- [ ] Error handling (10 tests)
- **Target**: 120 total tests

### Phase 4: Add Performance Tests 📝
- [ ] Schema processing performance
- [ ] Memory usage tests
- [ ] Validation performance
- **Target**: 130 total tests

### Phase 5: Add Regression Tests 📝
- [ ] Known bug regression tests (5 tests)
- **Target**: 135 total tests

---

## Test Automation

### GitHub Actions CI
```yaml
name: Gemini API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test:gemini
      - run: bun test:e2e  # Requires test API key
```

### Coverage Targets
- **Unit tests**: 100% coverage of translation logic
- **Integration tests**: All 12 features covered
- **Edge cases**: 30+ edge case scenarios
- **Overall target**: 95%+ code coverage

---

## Continuous Validation

### Pre-commit Hooks
```json
{
  "scripts": {
    "test:gemini": "bun test tests/gemini-*.test.ts",
    "test:watch": "bun test --watch tests/gemini-*.test.ts"
  }
}
```

### Test Data Fixtures
Create: `tests/fixtures/gemini-requests.json`
```json
{
  "simpleText": {...},
  "withSystemInstruction": {...},
  "withTools": {...},
  "nestedSchema": {...}
}
```

---

## Success Criteria

### Coverage Metrics
- ✅ Unit test coverage: 100%
- 📝 Integration test coverage: 90%+ (target)
- 📝 Edge case coverage: 80%+ (target)
- 📝 All 12 features validated (target)

### Performance Benchmarks
- Schema translation: < 100ms for complex schemas
- Request validation: < 50ms per request
- Memory usage: < 50MB increase per 1000 tools

### Quality Gates
- All tests passing before merge
- No regressions in existing functionality
- Clear error messages for all failure cases
- Documentation updated for new features

---

## Next Steps

1. **Implement Integration Tests**: Start with `gemini-e2e.test.ts`
2. **Add Edge Case Tests**: Cover all identified edge cases
3. **Performance Benchmarks**: Establish baseline metrics
4. **CI/CD Integration**: Automate test execution
5. **Test Documentation**: Document test patterns and examples
