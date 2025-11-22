import { describe, test, expect, mock } from "bun:test"
import { Hono } from "hono"

import { geminiRoute } from "../src/routes/gemini/route"

describe("Gemini API endpoint tests", () => {
  const app = new Hono()
  app.route("/", geminiRoute)

  test("should return 400 for missing contents field", async () => {
    const res = await app.request("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Missing contents
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(body.error.message).toContain("contents")
  })

  test("should return 400 for invalid JSON", async () => {
    const res = await app.request("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json{",
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  test("should accept valid request with minimal fields", async () => {
    const res = await app.request("/v1beta/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
        ],
      }),
    })

    // Should not be 400 - might be 500 if Copilot token not found, or 200 if it works
    expect(res.status).not.toBe(400)
  })

  test("should handle v1 endpoint", async () => {
    const res = await app.request("/v1/models/gemini-2.5-pro:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
        ],
      }),
    })

    expect(res.status).not.toBe(404) // Route should exist
    expect(res.status).not.toBe(400) // Request should be valid
  })

  test("should handle streaming endpoint", async () => {
    const res = await app.request("/v1beta/models/gemini-2.5-pro:streamGenerateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
        ],
      }),
    })

    expect(res.status).not.toBe(404) // Route should exist
    expect(res.status).not.toBe(400) // Request should be valid
  })

  test("should accept supported Gemini models", async () => {
    // Test with supported model names
    const supportedModels = ["gemini-2.5-pro", "gemini-3-pro-preview"]

    for (const model of supportedModels) {
      const res = await app.request(`/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Test" }],
            },
          ],
        }),
      })

      // Should not be 400 - model is supported
      expect(res.status).not.toBe(400)
    }
  })

  test("should reject unsupported Gemini models", async () => {
    // Test with unsupported model names
    const unsupportedModels = ["gemini-2.5-flash-lite", "gemini-1.5-pro", "gemini-ultra"]

    for (const model of unsupportedModels) {
      const res = await app.request(`/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Test" }],
            },
          ],
        }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBeDefined()
      expect(body.error.message).toContain("Unsupported model")
      expect(body.error.message).toContain("gemini-2.5-pro")
      expect(body.error.message).toContain("gemini-3-pro-preview")
    }
  })
})
