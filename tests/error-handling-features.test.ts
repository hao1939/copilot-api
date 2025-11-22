import { describe, test, expect } from "bun:test"

describe("API error handling", () => {
  test("should return 404 for unknown routes", async () => {
    const res = await fetch("http://localhost:3000/unknown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(404)
    const body = await res.text()
    expect(body).toContain("Not Found")
  })

  test("should return 405 for wrong method on /v1/chat/completions", async () => {
    const res = await fetch("http://localhost:3000/v1/chat/completions", {
      method: "GET",
    })
    expect(res.status).toBe(405)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain("Method Not Allowed")
  })

  test("should return 400 for invalid JSON body", async () => {
    const res = await fetch("http://localhost:3000/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ 'invalid': json }",
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain("Invalid JSON")
  })

  test("should return 401 for missing Authorization header", async () => {
    const res = await fetch("http://localhost:3000/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-pro",
        messages: [{ role: "user", content: "Hello" }],
      }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain("Missing Authorization header")
  })

  test("should return 401 for invalid Bearer token", async () => {
    const res = await fetch("http://localhost:3000/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify({
        model: "gemini-pro",
        messages: [{ role: "user", content: "Hello" }],
      }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain("Invalid token")
  })
})
