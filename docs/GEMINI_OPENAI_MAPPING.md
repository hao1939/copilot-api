# Gemini API to OpenAI API Mapping

This document defines the systematic mapping between Google Gemini API and OpenAI API formats.

## Request Structure Mapping

### Top-Level Fields

| Gemini API | OpenAI API | Notes |
|------------|------------|-------|
| `contents[]` | `messages[]` | Array of conversation turns |
| `tools[]` | `tools[]` | Function calling definitions |
| `systemInstruction` | `messages[0]` with `role: "system"` | System message |
| `generationConfig` | Multiple fields | Split into temperature, max_tokens, top_p, etc. |
| `safetySettings[]` | N/A | Not supported in OpenAI |
| `cachedContent` | N/A | Not supported in OpenAI |

### Contents/Messages Mapping

| Gemini `contents` | OpenAI `messages` | Notes |
|-------------------|-------------------|-------|
| `role: "user"` | `role: "user"` | Direct mapping |
| `role: "model"` | `role: "assistant"` | Model → Assistant |
| `role: "function"` | `role: "tool"` | Function responses |
| `parts[]` | `content` | Array of parts → single content string/array |
| `parts[].text` | `content` (string) | Text content |
| `parts[].inlineData` | `content` (array with image_url) | Images |
| `parts[].functionCall` | `tool_calls[]` | Function call from model |
| `parts[].functionResponse` | `tool_call_id` + `content` | Function response |

### Tools/Function Declarations Mapping

| Gemini API | OpenAI API | Notes |
|------------|------------|-------|
| `tools[].functionDeclarations[]` | `tools[]` | Array flattening |
| `functionDeclarations[].name` | `function.name` | Direct mapping |
| `functionDeclarations[].description` | `function.description` | Direct mapping |
| `functionDeclarations[].parameters` | `function.parameters` | **MUST add `additionalProperties: false` for strict mode** |
| `functionDeclarations[].parametersJsonSchema` | `function.parameters` | Alternative field name (gemini-cli uses this) |
| `functionDeclarations[].responseJsonSchema` | **IGNORED** | Not supported in OpenAI |

### Generation Config Mapping

| Gemini `generationConfig` | OpenAI API | Notes |
|----------------------------|------------|-------|
| `temperature` | `temperature` | Direct mapping (0.0-2.0) |
| `topP` | `top_p` | Direct mapping (0.0-1.0) |
| `topK` | N/A | Not supported in OpenAI |
| `maxOutputTokens` | `max_tokens` | Direct mapping |
| `stopSequences[]` | `stop` | Direct mapping |
| `candidateCount` | `n` | Number of completions |
| `responseMimeType: "application/json"` | `response_format: {type: "json_object"}` | JSON mode |
| `responseSchema` | `response_format: {type: "json_schema", json_schema: {...}}` | Structured output |

## Response Structure Mapping

### Top-Level Fields

| OpenAI Response | Gemini Response | Notes |
|-----------------|-----------------|-------|
| `choices[]` | `candidates[]` | Array of completions |
| `usage` | `usageMetadata` | Token counts |
| `id` | N/A | Generated UUID |
| `created` | N/A | Current timestamp |
| `model` | `modelVersion` | Model identifier |
| `system_fingerprint` | N/A | Not in Gemini |

### Choices/Candidates Mapping

| OpenAI `choices` | Gemini `candidates` | Notes |
|------------------|---------------------|-------|
| `message.role: "assistant"` | `content.role: "model"` | Assistant → Model |
| `message.content` | `content.parts[].text` | Single string → parts array |
| `message.tool_calls[]` | `content.parts[].functionCall` | Function calls |
| `finish_reason: "stop"` | `finishReason: "STOP"` | Normal completion |
| `finish_reason: "length"` | `finishReason: "MAX_TOKENS"` | Token limit |
| `finish_reason: "content_filter"` | `finishReason: "SAFETY"` | Content filtered |
| `finish_reason: "tool_calls"` | `finishReason: "STOP"` (with functionCall) | Function call made |

### Usage/Metadata Mapping

| OpenAI `usage` | Gemini `usageMetadata` | Notes |
|----------------|------------------------|-------|
| `prompt_tokens` | `promptTokenCount` | Input tokens |
| `completion_tokens` | `candidatesTokenCount` | Output tokens |
| `total_tokens` | `totalTokenCount` | Sum of input + output |

## Schema Translation Rules

### JSON Schema for Function Parameters

**Gemini Format:**
```json
{
  "type": "object",
  "properties": {
    "param": {"type": "string", "description": "..."}
  },
  "required": ["param"]
}
```

**OpenAI Format (Strict Mode):**
```json
{
  "type": "object",
  "properties": {
    "param": {"type": "string", "description": "..."}
  },
  "required": ["param"],
  "additionalProperties": false  // REQUIRED FOR STRICT MODE
}
```

**Translation Rules:**
1. **MUST** add `additionalProperties: false` to ALL object schemas (recursive)
2. **MUST** ensure all `array` types have `items` defined
3. **MUST** ensure all `required` fields exist in `properties`
4. **MUST** NOT include `nullable` (use union types instead)
5. **MUST** NOT include `$ref` (resolve all references)
6. **MUST** deep clone to avoid mutation

### Response Schema Translation

**Gemini `responseSchema`:**
```json
{
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": {
      "type": "object",
      "properties": {...}
    }
  }
}
```

**OpenAI `response_format`:**
```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "response",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {...},
        "additionalProperties": false  // REQUIRED
      }
    }
  }
}
```

## Function Calling Flow

### 1. User Provides Function Definitions (Gemini → OpenAI)

**Gemini:**
```json
{
  "tools": [{
    "functionDeclarations": [{
      "name": "get_weather",
      "parameters": {"type": "object", "properties": {...}}
    }]
  }]
}
```

**OpenAI:**
```json
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "parameters": {"type": "object", "properties": {...}, "additionalProperties": false},
      "strict": true
    }
  }]
}
```

### 2. Model Requests Function Call (OpenAI → Gemini)

**OpenAI:**
```json
{
  "message": {
    "role": "assistant",
    "tool_calls": [{
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"SF\"}"
      }
    }]
  }
}
```

**Gemini:**
```json
{
  "content": {
    "role": "model",
    "parts": [{
      "functionCall": {
        "name": "get_weather",
        "args": {"location": "SF"}
      }
    }]
  }
}
```

### 3. User Provides Function Result (Gemini → OpenAI)

**Gemini:**
```json
{
  "contents": [{
    "role": "function",
    "parts": [{
      "functionResponse": {
        "name": "get_weather",
        "response": {"temperature": 72}
      }
    }]
  }]
}
```

**OpenAI:**
```json
{
  "messages": [{
    "role": "tool",
    "tool_call_id": "call_123",
    "content": "{\"temperature\": 72}"
  }]
}
```

## Key Differences & Gotchas

### 1. Strict Mode Requirements
- **Gemini**: No strict mode, schemas are flexible
- **OpenAI**: Strict mode required for GitHub Copilot, schemas must be complete

### 2. Array vs Single Value
- **Gemini**: `parts[]` is always an array
- **OpenAI**: `content` can be string or array

### 3. Function Call Arguments
- **Gemini**: `args` is an object
- **OpenAI**: `arguments` is a JSON string

### 4. Role Names
- **Gemini**: "model" for assistant
- **OpenAI**: "assistant" for assistant

### 5. Finish Reasons
- **Gemini**: "MAX_TOKENS", "SAFETY", "RECITATION"
- **OpenAI**: "length", "content_filter", no "recitation"

### 6. Response Schema Support
- **Gemini**: `responseSchema` for output structure (Gemini-specific)
- **OpenAI**: `response_format` with `json_schema` type (different structure)
- **GitHub Copilot**: Supports `response_format` but NOT `responseJsonSchema` on tool definitions

## Implementation Checklist

- [ ] Validate all schemas before sending to OpenAI
- [ ] Add `additionalProperties: false` to ALL object schemas (recursively)
- [ ] Convert `parts[]` to single `content` string or array
- [ ] Map role names correctly (model ↔ assistant)
- [ ] Handle function calls bidirectionally
- [ ] Convert function call arguments (object ↔ JSON string)
- [ ] Map finish reasons correctly
- [ ] Handle `responseSchema` → `response_format` conversion
- [ ] Ignore `responseJsonSchema` on tool definitions (not supported by OpenAI)
- [ ] Deep clone all schemas to avoid mutation
- [ ] Validate all tool schemas before sending
- [ ] Provide detailed error messages on validation failure
