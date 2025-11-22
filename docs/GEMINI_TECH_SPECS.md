# Gemini API Support for copilot-api

This implementation adds Google Gemini API compatibility to copilot-api, allowing tools like gemini-cli to use GitHub Copilot through the Gemini API format.

## How It Works

```
gemini-cli → Gemini API format → copilot-api → OpenAI format → GitHub Copilot
                                  (translation)
```

The implementation follows the same pattern as the Anthropic/Claude support:

1. **Request Flow**: Gemini request → translated to OpenAI format → sent to Copilot
2. **Response Flow**: Copilot response (OpenAI format) → translated to Gemini format → returned to client

## Setup

### 1. Start copilot-api

```bash
# Clone and install
git clone https://github.com/ericc-ch/copilot-api.git
cd copilot-api
npm install

# Start the server (this will authenticate with GitHub)
npx copilot-api start
```

The server will start on `http://localhost:4141`

### 2. Configure gemini-cli to use the proxy

Set the environment variable to point gemini-cli to your local copilot-api instance:

```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
```

### 3. Use gemini-cli normally

```bash
gemini "What is the capital of France?"
```

All requests will now go through copilot-api to GitHub Copilot!

## API Endpoint

The implementation exposes the Gemini API endpoint:

```
POST /v1/models/{model}:generateContent
```

### Example Request

```bash
curl http://localhost:4141/v1/models/gemini-pro:generateContent \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "Hello!"}]
    }]
  }'
```

### Example Response

```json
{
  "candidates": [{
    "content": {
      "role": "model",
      "parts": [{"text": "Hello! How can I help you today?"}]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": {
    "promptTokenCount": 5,
    "candidatesTokenCount": 10,
    "totalTokenCount": 15
  }
}
```

## Supported Features

✅ Text generation
✅ Multi-turn conversations
✅ System instructions
✅ Temperature, topP, maxTokens configuration
✅ Stop sequences
✅ Function calling (tools)
✅ Images (inline data)
✅ Token usage tracking

⏳ Streaming responses (planned, following Anthropic implementation pattern)

## Implementation Details

### Files Added

- `src/routes/gemini/gemini-types.ts` - Gemini API type definitions
- `src/routes/gemini/translation.ts` - Translation functions between Gemini and OpenAI formats
- `src/routes/gemini/handler.ts` - Request handler
- `src/routes/gemini/route.ts` - Route definition
- Modified `src/server.ts` - Registered Gemini route

### Key Translations

**Request**: `contents` → `messages`, `parts` → `content`
**Response**: `choices` → `candidates`, `message.content` → `content.parts`
**Tools**: `functionDeclarations` → `functions`, `functionCall` → `tool_calls`

## Testing

To test the implementation:

```bash
# Start copilot-api in one terminal
npx copilot-api start

# In another terminal, test with curl
curl http://localhost:4141/v1/models/gpt-4:generateContent \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "Write a haiku about coding"}]
    }],
    "generationConfig": {
      "temperature": 0.7
    }
  }'
```

Or use gemini-cli:

```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
gemini "Write a haiku about coding"
```

## Notes

- The `model` parameter in the URL is passed to Copilot (e.g., `gpt-4`, `claude-sonnet-4`)
- All GitHub Copilot authentication is handled by copilot-api
- Rate limiting and manual approval features work with Gemini requests
- Debug logging shows request/response translations

## Architecture

This implementation leverages the fact that GitHub Copilot uses OpenAI-compatible API format internally. The translation layer simply converts between Gemini's format and OpenAI's format, then uses copilot-api's existing infrastructure to communicate with GitHub Copilot.
