import type { Context } from "hono"

import consola from "consola"
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
    consola.error("Failed to parse JSON request body:", error)
    return c.json({ error: "Invalid JSON in request body" }, 400)
  }

  consola.debug("Gemini request payload:", JSON.stringify(geminiPayload))

  // Log tools if present to debug parameter schema issue
  if (geminiPayload.tools && geminiPayload.tools.length > 0) {
    consola.info("Raw Gemini tools from request:")
    consola.info(JSON.stringify(geminiPayload.tools, null, 2))
  }

  // Validate required fields
  if (!geminiPayload.contents || !Array.isArray(geminiPayload.contents)) {
    consola.error("Missing or invalid 'contents' field in request")
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
    consola.error("Could not extract model from path:", path)
    return c.json({ error: "Model parameter is required" }, 400)
  }

  // Validate that the model is a supported Gemini model
  const SUPPORTED_GEMINI_MODELS = [
    "gemini-2.5-pro",
    "gemini-3-pro-preview",
  ]

  if (!SUPPORTED_GEMINI_MODELS.includes(model)) {
    consola.error(`Unsupported Gemini model requested: ${model}`)
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

  consola.debug("Extracted model from path:", model)

  // Detect if streaming is requested
  const isStreaming = path.includes("streamGenerateContent")

  try {
    const openAIPayload = translateGeminiToOpenAI(geminiPayload)
    openAIPayload.model = model
    openAIPayload.stream = isStreaming

    consola.debug(
      "Translated OpenAI request payload:",
      JSON.stringify(openAIPayload),
    )

    // Log tools in detail if present
    if (openAIPayload.tools && openAIPayload.tools.length > 0) {
      consola.info(`Request includes ${openAIPayload.tools.length} tool(s)`)
      consola.info("Tools:", JSON.stringify(openAIPayload.tools, null, 2))
    }

    if (state.manualApprove) {
      await awaitApproval()
    }

    const response = await createChatCompletions(openAIPayload)

    // Non-streaming response
    if (isNonStreaming(response)) {
      consola.debug(
        "Non-streaming response from Copilot:",
        JSON.stringify(response).slice(-400),
      )
      const geminiResponse = translateOpenAIToGemini(response)
      consola.debug(
        "Translated Gemini response:",
        JSON.stringify(geminiResponse),
      )
      return c.json(geminiResponse)
    }

    // Streaming response
    consola.debug("Streaming response from Copilot")
    consola.info("Starting SSE stream for Gemini")
    return streamSSE(c, async (stream) => {
      consola.info("Inside streamSSE callback, about to iterate")
      let eventCount = 0
      for await (const rawEvent of response) {
        eventCount++
        consola.info(`Received event #${eventCount}`)
        consola.debug("Copilot raw stream event:", JSON.stringify(rawEvent))

        if (rawEvent.data === "[DONE]") {
          break
        }

        if (!rawEvent.data) {
          continue
        }

        try {
          const chunk = JSON.parse(rawEvent.data) as ChatCompletionChunk
          const geminiChunk = translateOpenAIToGemini(chunk)

          consola.debug("Translated Gemini chunk:", JSON.stringify(geminiChunk))

          // Send as SSE data event
          await stream.writeSSE({
            data: JSON.stringify(geminiChunk),
          })
          consola.info(`Sent Gemini chunk #${eventCount}`)
        } catch (error) {
          consola.error("Error parsing stream chunk:", error)
        }
      }
      consola.info(`Stream complete. Total events: ${eventCount}`)
    })
  } catch (error) {
    consola.error("=== ERROR CAUGHT IN HANDLER ===")
    consola.error("Error processing request:", error)
    consola.error("Error type:", error?.constructor?.name)
    consola.error("Error message:", error instanceof Error ? error.message : String(error))

    // Log stack trace if available
    if (error instanceof Error && error.stack) {
      consola.error("Error stack trace:", error.stack)
    }

    // If it's an HTTPError from Copilot, get more details
    if (error instanceof Error && "response" in error) {
      const httpError = error as { response: Response; message: string; responseBody?: string }

      // Try to use cached responseBody first (from HTTPError)
      let errorBody: string
      if ("responseBody" in httpError && typeof httpError.responseBody === "string") {
        errorBody = httpError.responseBody
        consola.error("Copilot API error body (from HTTPError):", errorBody)
      } else {
        // Try to read from response
        try {
          errorBody = await httpError.response.clone().text()
          consola.error("Copilot API error body (from response):", errorBody)
        } catch (readError) {
          // Fallback if we can't read the response body
          consola.error("Could not read Copilot API error body:", readError)
          if (readError instanceof Error && readError.stack) {
            consola.error("Read error stack:", readError.stack)
          }

          // Return error with status but without body
          consola.error("Copilot API status:", httpError.response.status)
          return c.json(
            {
              error: {
                message: `Copilot API error (status ${httpError.response.status}): ${httpError.message}`,
                code: httpError.response.status,
                status: httpError.response.status,
              },
            },
            httpError.response.status,
          )
        }
      }

      // Try to parse the error body as JSON to get structured error
      let errorDetails: unknown
      try {
        errorDetails = JSON.parse(errorBody)
      } catch {
        errorDetails = errorBody
      }

      consola.error("Copilot API status:", httpError.response.status)
      consola.error("Copilot API error details:", errorDetails)

      // Return the original error to the client for better debugging
      return c.json(
        {
          error: {
            message: `Copilot API error: ${errorBody}`,
            code: httpError.response.status,
            status: httpError.response.status,
            details: errorDetails, // Include parsed error details
          },
        },
        httpError.response.status,
      )
    }

    // For non-HTTP errors, include stack trace for debugging
    const errorStack = error instanceof Error ? error.stack : undefined
    return c.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Internal error",
          code: 500,
          stack: errorStack,
        },
      },
      500,
    )
  }
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof createChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")
