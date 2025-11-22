// Gemini API Types

export interface GeminiGenerateContentPayload {
  contents: Array<GeminiContent>
  systemInstruction?: GeminiContent
  generationConfig?: GeminiGenerationConfig
  safetySettings?: Array<GeminiSafetySetting>
  tools?: Array<GeminiTool>
  toolConfig?: GeminiToolConfig
}

export interface GeminiContent {
  role?: "user" | "model"
  parts: Array<GeminiPart>
}

export type GeminiPart =
  | GeminiTextPart
  | GeminiInlineDataPart
  | GeminiFileDataPart
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart

export interface GeminiTextPart {
  text: string
}

export interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string
    data: string
  }
}

export interface GeminiFileDataPart {
  fileData: {
    mimeType: string
    fileUri: string
  }
}

export interface GeminiFunctionCallPart {
  functionCall: {
    name: string
    args: Record<string, unknown>
  }
}

export interface GeminiFunctionResponsePart {
  functionResponse: {
    id?: string  // Optional ID added by gemini-cli for tracking responses
    name: string
    response: Record<string, unknown>
  }
}

export interface GeminiGenerationConfig {
  temperature?: number
  topP?: number
  topK?: number
  maxOutputTokens?: number
  stopSequences?: Array<string>
  candidateCount?: number
  responseMimeType?: string
  responseSchema?: Record<string, unknown>
}

export interface GeminiSafetySetting {
  category: string
  threshold: string
}

export interface GeminiTool {
  functionDeclarations?: Array<GeminiFunctionDeclaration>
}

export interface GeminiFunctionDeclaration {
  name: string
  description?: string
  parameters?: Record<string, unknown>
  parametersJsonSchema?: Record<string, unknown>
  responseJsonSchema?: Record<string, unknown> // Gemini-specific: defines tool output schema
}

export interface GeminiToolConfig {
  functionCallingConfig?: {
    mode?: "AUTO" | "ANY" | "NONE"
    allowedFunctionNames?: Array<string>
  }
}

// Response types

export interface GeminiGenerateContentResponse {
  candidates: Array<GeminiCandidate>
  usageMetadata?: GeminiUsageMetadata
  modelVersion?: string
}

export interface GeminiCandidate {
  content: GeminiContent
  finishReason?:
    | "FINISH_REASON_UNSPECIFIED"
    | "STOP"
    | "MAX_TOKENS"
    | "SAFETY"
    | "RECITATION"
    | "OTHER"
  safetyRatings?: Array<GeminiSafetyRating>
  citationMetadata?: GeminiCitationMetadata
  tokenCount?: number
}

export interface GeminiSafetyRating {
  category: string
  probability: string
}

export interface GeminiCitationMetadata {
  citations: Array<GeminiCitationSource>
}

export interface GeminiCitationSource {
  startIndex?: number
  endIndex?: number
  uri?: string
  license?: string
}

export interface GeminiUsageMetadata {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
  cachedContentTokenCount?: number
}

// Streaming response types

export type GeminiStreamChunk = GeminiGenerateContentResponse

// Helper type guards

export function isTextPart(part: GeminiPart): part is GeminiTextPart {
  return "text" in part
}

export function isInlineDataPart(part: GeminiPart): part is GeminiInlineDataPart {
  return "inlineData" in part
}

export function isFileDataPart(part: GeminiPart): part is GeminiFileDataPart {
  return "fileData" in part
}

export function isFunctionCallPart(
  part: GeminiPart,
): part is GeminiFunctionCallPart {
  return "functionCall" in part
}

export function isFunctionResponsePart(
  part: GeminiPart,
): part is GeminiFunctionResponsePart {
  return "functionResponse" in part
}
