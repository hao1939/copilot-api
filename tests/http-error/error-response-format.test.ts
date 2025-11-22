import { describe, test, expect } from "bun:test"
import { Hono } from "hono"

import { HTTPError, forwardError } from "../../src/lib/error"

describe("Error response format", () => {
  test("should return consistent error format for HTTPError", async () => {
    const app = new Hono()
    const mockResponse = new Response(
      JSON.stringify({ error: { message: "Test" } }),
      { status: 400 },
    )
    const error = new HTTPError(
      "Test",
      mockResponse,
      JSON.stringify({ error: { message: "Test" } }),
    )

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as { error: unknown }

    // Verify consistent error structure
    expect(body).toHaveProperty("error")
    const errorBody = body.error as {
      message: string
      type: string
      status: number
      statusText: string
    }
    expect(errorBody).toHaveProperty("message")
    expect(errorBody).toHaveProperty("type")
    expect(errorBody).toHaveProperty("status")
    expect(errorBody).toHaveProperty("statusText")
  })

  test("should return consistent error format for regular errors", async () => {
    const app = new Hono()
    const error = new Error("Test error")

    app.get("/test", async (c) => {
      return forwardError(c, error)
    })

    const response = await app.request("/test")
    const body = (await response.json()) as { error: unknown }

    // Verify consistent error structure
    expect(body).toHaveProperty("error")
    const errorBody = body.error as {
      message: string
      type: string
      stack: string
    }
    expect(errorBody).toHaveProperty("message")
    expect(errorBody).toHaveProperty("type")
    expect(errorBody).toHaveProperty("stack")
  })
})
