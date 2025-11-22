import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionsPayload,
  ContentPart,
  Message,
  Tool,
} from "~/services/copilot/create-chat-completions"

import type {
  GeminiCandidate,
  GeminiContent,
  GeminiGenerateContentPayload,
  GeminiGenerateContentResponse,
  GeminiPart,
} from "./gemini-types"
import {
  isFunctionCallPart,
  isFunctionResponsePart,
  isInlineDataPart,
  isTextPart,
} from "./gemini-types"

import {
  validateToolsForStrictMode,
  formatValidationErrors,
} from "./schema-validator"
import consola from "consola"

// Request translation: Gemini → OpenAI

export function translateGeminiToOpenAI(
  payload: GeminiGenerateContentPayload,
): ChatCompletionsPayload {
  const messages = translateGeminiContentsToOpenAI(
    payload.contents,
    payload.systemInstruction,
  )

  const tools = translateGeminiToolsToOpenAI(payload.tools)

  // Validate tools for OpenAI strict mode compliance
  if (tools && tools.length > 0) {
    const validation = validateToolsForStrictMode(tools)
    if (!validation.valid) {
      consola.error("Tool validation failed:")
      consola.error(formatValidationErrors(validation.errors))
      throw new Error(
        `Invalid tool schema for OpenAI strict mode:\n${formatValidationErrors(validation.errors)}`,
      )
    }
    consola.debug(`✓ All ${tools.length} tools validated successfully`)

    // Log translated tools for debugging
    consola.debug("Translated tools (first 3):")
    for (let i = 0; i < Math.min(3, tools.length); i++) {
      consola.debug(`Tool ${i + 1}: ${tools[i].function.name}`)
      consola.debug(JSON.stringify(tools[i].function.parameters, null, 2).substring(0, 500))
    }
  }

  // GitHub Copilot does not accept conversations ending with a tool message
  // If the last message is a tool message, append a dummy user message
  if (messages.length > 0 && messages[messages.length - 1].role === "tool") {
    consola.info("[Translation] Last message is a tool message, appending user message to satisfy GitHub Copilot requirements")
    messages.push({
      role: "user",
      content: "Please continue with the next step.",
    })
  }

  return {
    model: "gpt-4", // Default model, will be overridden by route parameter
    messages,
    temperature: payload.generationConfig?.temperature,
    top_p: payload.generationConfig?.topP,
    max_tokens: payload.generationConfig?.maxOutputTokens,
    stop: payload.generationConfig?.stopSequences,
    tools,
    tool_choice: translateGeminiToolConfigToOpenAI(payload.toolConfig),
    response_format: translateGeminiResponseFormatToOpenAI(
      payload.generationConfig,
    ),
    stream: false, // Will be set by handler if streaming
  }
}

function translateGeminiContentsToOpenAI(
  contents: Array<GeminiContent>,
  systemInstruction?: GeminiContent,
): Array<Message> {
  const messages: Array<Message> = []

  // Add system instruction if present
  if (systemInstruction) {
    const systemText = extractTextFromParts(systemInstruction.parts)
    if (systemText) {
      messages.push({ role: "system", content: systemText })
    }
  }

  // First pass: Build a queue of tool_call IDs that we generate for function calls
  // This allows us to match function responses to their corresponding calls
  const toolCallIdQueue: string[] = []
  let globalCallIndex = 0  // Global counter across all function calls

  for (const content of contents) {
    const functionCalls = content.parts.filter(isFunctionCallPart)
    if (functionCalls.length > 0) {
      // Generate IDs for all function calls in this content
      for (let i = 0; i < functionCalls.length; i++) {
        const fc = functionCalls[i]
        const id = `call_${fc.functionCall.name}_${Date.now()}_${globalCallIndex}`
        toolCallIdQueue.push(id)
        globalCallIndex++
      }
    }
  }

  // Second pass: Translate contents, matching function responses to call IDs
  let toolCallIdIndex = 0

  consola.info(`[Translation] Processing ${contents.length} contents, generated ${toolCallIdQueue.length} tool call IDs`)

  for (const content of contents) {
    const role = translateGeminiRoleToOpenAI(content.role)

    // Check if this content has function calls or responses
    const functionCalls = content.parts.filter(isFunctionCallPart)
    const functionResponses = content.parts.filter(isFunctionResponsePart)

    if (functionCalls.length > 0) {
      // Assistant message with tool calls
      consola.info(`[Translation] Found ${functionCalls.length} function calls in assistant message`)
      const textParts = content.parts.filter(isTextPart)
      const textContent = textParts.map((p) => p.text).join("\n\n") || null

      // Use the pre-generated IDs from the queue
      const toolCalls = functionCalls.map((fc, idx) => {
        const id = toolCallIdQueue[toolCallIdIndex]
        consola.info(`[Translation] Mapping functionCall '${fc.functionCall.name}' to ID '${id}' (queue index ${toolCallIdIndex})`)
        toolCallIdIndex++

        return {
          id,
          type: "function" as const,
          function: {
            name: fc.functionCall.name,
            arguments: JSON.stringify(fc.functionCall.args),
          },
        }
      })

      messages.push({
        role: "assistant",
        content: textContent,
        tool_calls: toolCalls,
      })

      // Debug: log tool_calls structure
      if (toolCalls.length > 0) {
        consola.info("Assistant message tool_calls:", JSON.stringify(toolCalls[0], null, 2))
      }
    } else if (functionResponses.length > 0) {
      // Tool response messages
      consola.info(`[Translation] Found ${functionResponses.length} function responses`)
      // IMPORTANT: Deduplicate function responses by their ID
      // Gemini-CLI sometimes sends duplicate functionResponse entries with the same ID
      // which would create invalid OpenAI conversation format (multiple tool messages for one tool call)
      const seenIds = new Set<string>()
      let responseIndex = 0

      for (const fr of functionResponses) {
        const responseId = fr.functionResponse.id

        // Skip if we've already seen this ID
        if (responseId && seenIds.has(responseId)) {
          consola.info(`[Translation] Skipping duplicate functionResponse with ID '${responseId}'`)
          continue
        }

        if (responseId) {
          seenIds.add(responseId)
        }

        // Use the corresponding tool_call ID from when we translated the function call
        // We match responses to calls in order
        const queueIndex = toolCallIdIndex - functionResponses.length + responseIndex
        const toolCallId = toolCallIdQueue[queueIndex]
        consola.info(`[Translation] Mapping functionResponse '${fr.functionResponse.name}' (gemini ID: ${responseId}) to tool_call_id '${toolCallId}' (queue index ${queueIndex})`)
        responseIndex++

        messages.push({
          role: "tool",
          tool_call_id: toolCallId,
          content: JSON.stringify(fr.functionResponse.response),
        })
      }
    } else {
      // Regular message
      const contentParts = translateGeminiPartsToOpenAI(content.parts)
      messages.push({
        role,
        content: contentParts,
      })
    }
  }

  return messages
}

function translateGeminiRoleToOpenAI(
  role?: "user" | "model",
): "user" | "assistant" | "system" {
  if (role === "model") return "assistant"
  return role ?? "user"
}

function translateGeminiPartsToOpenAI(
  parts: Array<GeminiPart>,
): string | Array<ContentPart> | null {
  // Check if there are any images
  const hasImage = parts.some(isInlineDataPart)

  if (!hasImage) {
    // Text only - return as string
    return extractTextFromParts(parts)
  }

  // Mixed content - return as array
  const contentParts: Array<ContentPart> = []

  for (const part of parts) {
    if (isTextPart(part)) {
      contentParts.push({ type: "text", text: part.text })
    } else if (isInlineDataPart(part)) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        },
      })
    }
  }

  return contentParts.length > 0 ? contentParts : null
}

function extractTextFromParts(parts: Array<GeminiPart>): string {
  return parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join("\n\n")
}

/**
 * Recursively adds additionalProperties: false to all object schemas.
 * This is required for OpenAI's strict mode compliance.
 *
 * IMPORTANT: This function performs a DEEP CLONE to avoid mutating the input schema.
 * It ensures that EVERY object type (at any nesting level) gets additionalProperties: false.
 */
function addAdditionalPropertiesFalse(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  // Deep clone to avoid mutation
  const result: Record<string, unknown> = {}

  // Copy all fields from input schema
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && typeof value === "object" && value !== null) {
      // Recursively process all property definitions
      const properties = value as Record<string, unknown>
      result.properties = Object.fromEntries(
        Object.entries(properties).map(([propKey, propValue]) => {
          if (typeof propValue === "object" && propValue !== null && !Array.isArray(propValue)) {
            return [propKey, addAdditionalPropertiesFalse(propValue as Record<string, unknown>)]
          }
          // For arrays and primitives, clone them
          return [propKey, Array.isArray(propValue) ? [...propValue] : propValue]
        }),
      )
    } else if (key === "items" && typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recursively process array item schemas
      result.items = addAdditionalPropertiesFalse(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      // Deep clone arrays - important for enum, required, etc.
      result[key] = [...value]
    } else if (typeof value === "object" && value !== null) {
      // For other nested objects, recursively process them too
      // This handles cases like nested schemas that aren't in properties/items
      result[key] = addAdditionalPropertiesFalse(value as Record<string, unknown>)
    } else {
      // Copy primitives directly
      result[key] = value
    }
  }

  // ALWAYS add additionalProperties: false if this is an object schema
  if (result.type === "object") {
    result.additionalProperties = false
  }

  return result
}

function translateGeminiToolsToOpenAI(
  tools?: Array<{ functionDeclarations?: Array<unknown> }>,
): Array<Tool> | undefined {
  if (!tools || tools.length === 0) return undefined

  const openAITools: Array<Tool> = []

  for (const tool of tools) {
    if (tool.functionDeclarations) {
      for (const func of tool.functionDeclarations) {
        const f = func as {
          name: string
          description?: string
          parameters?: Record<string, unknown>
          parametersJsonSchema?: Record<string, unknown>
          responseJsonSchema?: Record<string, unknown> // Gemini-specific, not supported by OpenAI
        }

        // OpenAI requires parameters to be a valid JSON Schema
        // gemini-cli sends parametersJsonSchema, standard Gemini API sends parameters
        // Note: responseJsonSchema (for tool outputs) is NOT supported by OpenAI - we ignore it
        let parameters = f.parametersJsonSchema || f.parameters

        // If empty or missing, provide a minimal valid schema
        if (!parameters || Object.keys(parameters).length === 0) {
          parameters = {
            type: "object",
            properties: {},
            additionalProperties: false,
          }
        } else {
          // Recursively add additionalProperties: false for strict mode compliance
          // The function performs a deep clone and ensures ALL object schemas get the field
          parameters = addAdditionalPropertiesFalse(parameters)
        }

        openAITools.push({
          type: "function",
          function: {
            name: f.name,
            description: f.description,
            parameters,
            strict: true,
          },
        })
      }
    }
  }

  return openAITools.length > 0 ? openAITools : undefined
}

function translateGeminiToolConfigToOpenAI(
  toolConfig?: { functionCallingConfig?: { mode?: string } },
): ChatCompletionsPayload["tool_choice"] {
  if (!toolConfig?.functionCallingConfig) return undefined

  const mode = toolConfig.functionCallingConfig.mode

  switch (mode) {
    case "AUTO": {
      return "auto"
    }
    case "ANY": {
      return "required"
    }
    case "NONE": {
      return "none"
    }
    default: {
      return undefined
    }
  }
}

function translateGeminiResponseFormatToOpenAI(
  generationConfig?: {
    responseMimeType?: string
    responseSchema?: Record<string, unknown>
  },
): ChatCompletionsPayload["response_format"] {
  if (!generationConfig) return undefined

  const { responseMimeType, responseSchema } = generationConfig

  // If no response format specified, return undefined
  if (!responseMimeType && !responseSchema) return undefined

  // If only responseMimeType is set to JSON (without schema), use json_object mode
  if (
    responseMimeType === "application/json" &&
    (!responseSchema || Object.keys(responseSchema).length === 0)
  ) {
    return { type: "json_object" }
  }

  // If responseSchema is provided, use structured output with json_schema
  if (responseSchema && Object.keys(responseSchema).length > 0) {
    // Process schema to ensure OpenAI compatibility
    // - Convert integer to number
    // - Add additionalProperties: false for objects
    const processedSchema = addAdditionalPropertiesFalse(responseSchema)

    return {
      type: "json_schema",
      json_schema: {
        name: "gemini_response_schema",
        schema: processedSchema,
        strict: true,
      },
    }
  }

  return undefined
}

// Response translation: OpenAI → Gemini

// Overload for complete response
export function translateOpenAIToGemini(
  response: ChatCompletionResponse,
): GeminiGenerateContentResponse
// Overload for streaming chunk
export function translateOpenAIToGemini(
  chunk: ChatCompletionChunk,
): GeminiGenerateContentResponse
// Implementation
export function translateOpenAIToGemini(
  response: ChatCompletionResponse | ChatCompletionChunk,
): GeminiGenerateContentResponse {
  // Handle streaming chunks
  if ("object" in response && response.object === "chat.completion.chunk") {
    const chunk = response as ChatCompletionChunk
    return translateChunkToGemini(chunk)
  }

  // Check if this is actually a chunk by looking for delta instead of message
  if ("choices" in response && response.choices[0] && "delta" in response.choices[0]) {
    const chunk = response as ChatCompletionChunk
    return translateChunkToGemini(chunk)
  }

  // Handle complete responses
  const completeResponse = response as ChatCompletionResponse
  return {
    candidates: completeResponse.choices.map((choice) =>
      translateChoiceToCandidate(choice),
    ),
    usageMetadata: {
      promptTokenCount: completeResponse.usage?.prompt_tokens ?? 0,
      candidatesTokenCount: completeResponse.usage?.completion_tokens ?? 0,
      totalTokenCount: completeResponse.usage?.total_tokens ?? 0,
      cachedContentTokenCount:
        completeResponse.usage?.prompt_tokens_details?.cached_tokens,
    },
  }
}

function translateChunkToGemini(
  chunk: ChatCompletionChunk,
): GeminiGenerateContentResponse {
  const choice = chunk.choices[0]
  if (!choice) {
    // Empty chunk
    return {
      candidates: [],
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      },
    }
  }

  const parts: Array<GeminiPart> = []

  // Add text delta
  if (choice.delta.content) {
    parts.push({ text: choice.delta.content })
  }

  // Add tool call deltas
  if (choice.delta.tool_calls) {
    for (const toolCall of choice.delta.tool_calls) {
      if (toolCall.function?.name) {
        // New tool call starting
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: toolCall.function.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {},
          },
        })
      }
    }
  }

  return {
    candidates: [
      {
        content: {
          role: "model",
          parts,
        },
        finishReason: translateOpenAIFinishReasonToGemini(
          choice.finish_reason,
        ),
      },
    ],
    usageMetadata: chunk.usage
      ? {
          promptTokenCount: chunk.usage.prompt_tokens ?? 0,
          candidatesTokenCount: chunk.usage.completion_tokens ?? 0,
          totalTokenCount: chunk.usage.total_tokens ?? 0,
          cachedContentTokenCount:
            chunk.usage.prompt_tokens_details?.cached_tokens,
        }
      : undefined,
  }
}

function translateChoiceToCandidate(
  choice: ChatCompletionResponse["choices"][0],
): GeminiCandidate {
  const parts: Array<GeminiPart> = []

  // Add text content
  if (choice.message.content) {
    parts.push({ text: choice.message.content })
  }

  // Add tool calls as function calls
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      parts.push({
        functionCall: {
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments) as Record<
            string,
            unknown
          >,
        },
      })
    }
  }

  const geminiFinishReason = translateOpenAIFinishReasonToGemini(choice.finish_reason)

  // Log when finish_reason is translated to something unexpected
  if (geminiFinishReason === "OTHER" || geminiFinishReason === undefined) {
    console.log(`[DEBUG] OpenAI finish_reason: ${choice.finish_reason} → Gemini: ${geminiFinishReason}`)
    console.log(`[DEBUG] Has tool_calls: ${!!choice.message.tool_calls}`)
  }

  return {
    content: {
      role: "model",
      parts,
    },
    finishReason: geminiFinishReason,
  }
}

function translateOpenAIFinishReasonToGemini(
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null,
):
  | "FINISH_REASON_UNSPECIFIED"
  | "STOP"
  | "MAX_TOKENS"
  | "SAFETY"
  | "RECITATION"
  | "OTHER"
  | undefined {
  switch (finishReason) {
    case "stop": {
      return "STOP"
    }
    case "length": {
      return "MAX_TOKENS"
    }
    case "content_filter": {
      return "SAFETY"
    }
    case "tool_calls": {
      // When response includes tool calls, Gemini expects STOP finish reason
      return "STOP"
    }
    case null: {
      // null finish_reason during streaming - don't set a finish reason yet
      return undefined
    }
    case undefined: {
      // undefined finish_reason - streaming in progress
      return undefined
    }
    default: {
      return "OTHER"
    }
  }
}
