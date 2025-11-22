import { describe, test, expect } from "bun:test"

import { HTTPError } from "../../src/lib/error"

describe("HTTPError class", () => {
  test("should store response and optional responseBody", () => {
    const mockResponse = new Response("Error body", { status: 400 })
    const error = new HTTPError("Test error", mockResponse, "Cached error body")

    expect(error.message).toBe("Test error")
    expect(error.response).toBe(mockResponse)
    expect(error.responseBody).toBe("Cached error body")
  })

  test("should work without responseBody", () => {
    const mockResponse = new Response("Error body", { status: 500 })
    const error = new HTTPError("Test error", mockResponse)

    expect(error.message).toBe("Test error")
    expect(error.response).toBe(mockResponse)
    expect(error.responseBody).toBeUndefined()
  })

  test("should extend Error and have stack trace", () => {
    const mockResponse = new Response("Error body", { status: 404 })
    const error = new HTTPError("Test error", mockResponse)

    expect(error instanceof Error).toBe(true)
    expect(error.stack).toBeDefined()
  })
})
