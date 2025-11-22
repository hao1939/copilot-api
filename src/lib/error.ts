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
  if (error instanceof HTTPError) {
    // Use cached responseBody if available, otherwise try to read it
    let errorText: string
    if (error.responseBody) {
      errorText = error.responseBody
    } else {
      try {
        errorText = await error.response.clone().text()
      } catch {
        errorText = "Could not read error response body"
      }
    }

    // Log HTTP errors concisely
    consola.error(
      `HTTP ${error.response.status} error:`,
      errorText.length > 200 ? errorText.slice(0, 200) + "..." : errorText,
    )

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

  // For non-HTTP errors, log concisely
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  consola.error("Error:", errorMessage)

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
