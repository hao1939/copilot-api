import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import consola from "consola"

export class HTTPError extends Error {
  response: Response
  responseBody?: string

  constructor(message: string, response: Response, responseBody?: string) {
    super(message)
    this.response = response
    this.responseBody = responseBody
  }
}

export async function forwardError(c: Context, error: unknown) {
  // Log the full error with stack trace
  consola.error("Error occurred:", error)
  if (error instanceof Error && error.stack) {
    consola.error("Error stack:", error.stack)
  }

  if (error instanceof HTTPError) {
    // Use cached responseBody if available, otherwise try to read it
    let errorText: string
    if (error.responseBody) {
      errorText = error.responseBody
      consola.error("HTTP error response body (cached):", errorText)
    } else {
      try {
        errorText = await error.response.clone().text()
        consola.error("HTTP error response body:", errorText)
      } catch (e) {
        errorText = "Could not read error response body"
        consola.error("Failed to read error response body:", e)
        if (e instanceof Error && e.stack) {
          consola.error("Read error stack:", e.stack)
        }
      }
    }

    // Try to parse as JSON to get structured error
    let errorJson: unknown
    try {
      errorJson = JSON.parse(errorText)
    } catch {
      errorJson = errorText
    }
    consola.error("HTTP error (parsed):", errorJson)
    consola.error("HTTP status:", error.response.status)
    consola.error("HTTP status text:", error.response.statusText)

    // Return the original error to the client for better debugging
    return c.json(
      {
        error: {
          message: errorText,
          type: "error",
          status: error.response.status,
          statusText: error.response.statusText,
        },
      },
      error.response.status as ContentfulStatusCode,
    )
  }

  // For non-HTTP errors, return detailed error information
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  consola.error("Non-HTTP error message:", errorMessage)
  if (errorStack) {
    consola.error("Non-HTTP error stack:", errorStack)
  }

  return c.json(
    {
      error: {
        message: errorMessage,
        type: "error",
        stack: errorStack, // Include stack trace for debugging
      },
    },
    500,
  )
}
