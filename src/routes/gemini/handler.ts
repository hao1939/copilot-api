import type { Context } from "hono"

import { streamSSE } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import {
  createChatCompletions,
  type ChatCompletionChunk,
  type ChatCompletionResponse,
} from "~/services/copilot/create-chat-completions"

import type { GeminiGenerateContentPayload } from "./gemini-types"

import { translateGeminiToOpenAI, translateOpenAIToGemini } from "./translation"

export async function handleGenerateContent(c: Context) {
  await checkRateLimit(state)

  let geminiPayload: GeminiGenerateContentPayload
  try {
    geminiPayload = await c.req.json<GeminiGenerateContentPayload>()
  } catch (error) {
    return c.json(
      {
        error: {
          message: "Invalid JSON in request body",
          code: 400,
        },
      },
      400,
    )
  }

  // Validate required fields
  if (!Array.isArray(geminiPayload.contents)) {
    return c.json(
      {
        error: {
          message: "Request must include 'contents' array",
          code: 400,
        },
      },
      400,
    )
  }

  // Get model from URL path
  // Path format: /v1/models/gemini-2.5-pro:generateContent or :streamGenerateContent
  const path = c.req.path
  const modelMatch = path.match(/\/models\/([^:]+):/)
  const model = modelMatch?.[1]

  if (!model) {
    return c.json({ error: "Model parameter is required" }, 400)
  }

  // Validate that the model is a supported Gemini model
  const SUPPORTED_GEMINI_MODELS = ["gemini-2.5-pro", "gemini-3-pro-preview"]

  if (!SUPPORTED_GEMINI_MODELS.includes(model)) {
    return c.json(
      {
        error: {
          message: `Unsupported model: ${model}. Supported models: ${SUPPORTED_GEMINI_MODELS.join(", ")}`,
          code: 400,
        },
      },
      400,
    )
  }

  // Detect if streaming is requested
  const isStreaming = path.includes("streamGenerateContent")

  const openAIPayload = translateGeminiToOpenAI(geminiPayload)
  openAIPayload.model = model
  openAIPayload.stream = isStreaming

  if (state.manualApprove) {
    await awaitApproval()
  }

  const response = await createChatCompletions(openAIPayload)

  // Non-streaming response
  if (isNonStreaming(response)) {
    const geminiResponse = translateOpenAIToGemini(response)
    return c.json(geminiResponse)
  }

  // Streaming response
  return streamSSE(c, async (stream) => {
    for await (const rawEvent of response) {
      if (rawEvent.data === "[DONE]") {
        break
      }

      if (!rawEvent.data) {
        continue
      }

      try {
        const chunk = JSON.parse(rawEvent.data) as ChatCompletionChunk
        const geminiChunk = translateOpenAIToGemini(chunk)

        // Send as SSE data event
        await stream.writeSSE({
          data: JSON.stringify(geminiChunk),
        })
      } catch {
        // Ignore parsing errors in stream
      }
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof createChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")
