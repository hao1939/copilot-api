import { describe, test, expect, beforeEach } from "bun:test"
import { Hono } from "hono"

import { HTTPError, forwardError } from "../../src/lib/error"

describe("forwardError function", () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  test("should return cached responseBody from HTTPError", async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: { message: "Original error" } }),
      { status: 400, statusText: "Bad Request" },
    )
    const error = new HTTPError(
      "Test error",
      mockResponse,
      JSON.stringify({ error: { message: "Original error" } }),
    )

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as {
      error: { message: string; status: number; statusText: string }
    }

    expect(response.status).toBe(400)
    expect(body.error.message).toContain("Original error")
    expect(body.error.status).toBe(400)
    expect(body.error.statusText).toBe("Bad Request")
  })

  test("should handle HTTPError without cached responseBody", async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: { message: "GitHub Copilot error" } }),
      { status: 500, statusText: "Internal Server Error" },
    )
    const error = new HTTPError("Test error", mockResponse)

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as {
      error: { message: string; status: number; statusText: string }
    }

    expect(response.status).toBe(500)
    expect(body.error.message).toContain("GitHub Copilot error")
    expect(body.error.status).toBe(500)
    expect(body.error.statusText).toBe("Internal Server Error")
  })

  test("should handle regular Error objects", async () => {
    const error = new Error("Regular error message")

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as {
      error: { message: string; type: string; stack?: string }
    }

    expect(response.status).toBe(500)
    expect(body.error.message).toBe("Regular error message")
    expect(body.error.type).toBe("error")
    expect(body.error.stack).toBeDefined()
  })

  test("should handle non-Error objects", async () => {
    const error = "String error"

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as {
      error: { message: string; type: string }
    }

    expect(response.status).toBe(500)
    expect(body.error.message).toBe("String error")
    expect(body.error.type).toBe("error")
  })

  test("should preserve HTTP status codes from upstream errors", async () => {
    const statusCodes = [400, 401, 403, 404, 429, 500, 502, 503]

    for (const statusCode of statusCodes) {
      // Create fresh app for each status code to avoid "matcher is already built" error
      const testApp = new Hono()

      const mockResponse = new Response(
        JSON.stringify({ error: { message: `Error ${statusCode}` } }),
        { status: statusCode },
      )
      const error = new HTTPError(
        `Test error ${statusCode}`,
        mockResponse,
        JSON.stringify({ error: { message: `Error ${statusCode}` } }),
      )

      testApp.get(`/test`, async (c) => {
        return forwardError(c, error)
      })

      const response = await testApp.request(`/test`)
      const body = (await response.json()) as {
        error: { status: number }
      }

      expect(response.status).toBe(statusCode)
      expect(body.error.status).toBe(statusCode)
    }
  })

  test("should handle JSON parsing errors gracefully", async () => {
    const mockResponse = new Response("Not valid JSON", {
      status: 400,
      statusText: "Bad Request",
    })
    const error = new HTTPError("Test error", mockResponse, "Not valid JSON")

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as {
      error: { message: string; status: number }
    }

    expect(response.status).toBe(400)
    expect(body.error.message).toBe("Not valid JSON")
    expect(body.error.status).toBe(400)
  })

  test("should include error details for client debugging", async () => {
    const upstreamError = {
      error: {
        message: "invalid request body",
        code: "invalid_request_body",
        details: "Missing required field: messages",
      },
    }

    const mockResponse = new Response(JSON.stringify(upstreamError), {
      status: 400,
      statusText: "Bad Request",
    })
    const error = new HTTPError(
      "Failed to create chat completions",
      mockResponse,
      JSON.stringify(upstreamError),
    )

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as {
      error: {
        message: string
        status: number
        statusText: string
        type: string
      }
    }

    expect(response.status).toBe(400)
    expect(body.error.message).toContain("invalid request body")
    expect(body.error.status).toBe(400)
    expect(body.error.statusText).toBe("Bad Request")
    expect(body.error.type).toBe("error")
  })
})
