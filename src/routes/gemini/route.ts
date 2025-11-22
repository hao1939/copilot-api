import { Hono } from "hono"

import { forwardError } from "~/lib/error"

import { handleGenerateContent } from "./handler"

export const geminiRoute = new Hono()

// Gemini API endpoints - both v1 and v1beta
// The Gemini API uses paths like: /v1/models/gemini-2.5-pro:generateContent
// We need to match the model name which includes dashes and dots

// Match pattern: /v1/models/{anything}:generateContent or :streamGenerateContent
geminiRoute.post("/v1/models/*", async (c) => {
  try {
    return await handleGenerateContent(c)
  } catch (error) {
    return await forwardError(c, error)
  }
})

geminiRoute.post("/v1beta/models/*", async (c) => {
  try {
    return await handleGenerateContent(c)
  } catch (error) {
    return await forwardError(c, error)
  }
})
