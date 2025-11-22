# Configuring gemini-cli to Use GitHub Copilot via copilot-api

This guide shows you how to configure gemini-cli to use GitHub Copilot as its backend through the copilot-api proxy.

## Prerequisites

- GitHub Copilot subscription (Individual, Business, or Enterprise)
- Node.js or Bun installed
- gemini-cli installed (`npm install -g @google/gemini-cli`)

## Quick Start

### Step 1: Start copilot-api

First, start the copilot-api server. This will authenticate with GitHub and start the proxy server:

```bash
# If you haven't cloned the repo yet
git clone https://github.com/ericc-ch/copilot-api.git
cd copilot-api

# Install dependencies
npm install
# or
bun install

# Start the server (will open browser for GitHub authentication)
npx copilot-api start
# or with bun
bun run start
```

The server will:
1. Open your browser to authenticate with GitHub
2. Start listening on `http://localhost:4141` (default port)
3. Display usage information and token details

**Keep this terminal running** - the server needs to stay active.

### Step 2: Configure gemini-cli

In a **new terminal**, set the environment variable to point gemini-cli to your local copilot-api instance:

```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
```

To make this permanent, add it to your shell configuration:

**For Bash** (`~/.bashrc` or `~/.bash_profile`):
```bash
echo 'export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"' >> ~/.bashrc
source ~/.bashrc
```

**For Zsh** (`~/.zshrc`):
```bash
echo 'export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"' >> ~/.zshrc
source ~/.zshrc
```

**For Fish** (`~/.config/fish/config.fish`):
```bash
echo 'set -x GOOGLE_GEMINI_BASE_URL "http://localhost:4141"' >> ~/.config/fish/config.fish
source ~/.config/fish/config.fish
```

### Step 3: Use gemini-cli

Now you can use gemini-cli normally - all requests will go through copilot-api to GitHub Copilot:

```bash
# Interactive mode
gemini

# One-shot prompt
gemini "Explain how async/await works in JavaScript"

# With a specific model (will be passed to Copilot)
gemini -m gpt-4 "Write a Python function to calculate fibonacci"
```

## Advanced Configuration

### Custom Port

If you want to run copilot-api on a different port:

```bash
# Start on port 8080
npx copilot-api start --port 8080

# Update environment variable
export GOOGLE_GEMINI_BASE_URL="http://localhost:8080"
```

### Rate Limiting

To add rate limiting between requests:

```bash
# Wait 5 seconds between requests
npx copilot-api start --rate-limit 5

# Or wait for user confirmation
npx copilot-api start --rate-limit 5 --wait
```

### Manual Approval

For manual approval of each request:

```bash
npx copilot-api start --manual
```

### Account Type

Specify your Copilot account type (affects rate limits):

```bash
# For business or enterprise accounts
npx copilot-api start --account-type business

# For individual accounts (default)
npx copilot-api start --account-type individual
```

## Verification

### Test the Configuration

1. **Check copilot-api is running:**
```bash
curl http://localhost:4141/
# Should return: "Server running"
```

2. **Test with a simple Gemini request:**
```bash
curl http://localhost:4141/v1/models/gpt-4:generateContent \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "Say hello!"}]
    }]
  }'
```

3. **Test with gemini-cli:**
```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
gemini "What is 2+2?"
```

If you see a response, it's working! 🎉

### Check Usage

Visit the usage endpoint to see your Copilot API usage:

```bash
curl http://localhost:4141/usage
```

Or visit in your browser:
```
http://localhost:4141/usage
```

## Troubleshooting

### "Connection refused" Error

**Problem:** gemini-cli can't connect to copilot-api

**Solution:**
- Make sure copilot-api is running: `curl http://localhost:4141/`
- Check the port matches your configuration
- Verify the environment variable: `echo $GOOGLE_GEMINI_BASE_URL`

### "Copilot token not found" Error

**Problem:** copilot-api lost authentication

**Solution:**
- Restart copilot-api: `npx copilot-api start`
- Re-authenticate through the browser
- Check your GitHub Copilot subscription is active

### "Invalid model" or Model Not Found

**Problem:** The model name isn't recognized by Copilot

**Solution:**
- Use models supported by Copilot: `gpt-4`, `gpt-3.5-turbo`, `claude-sonnet-4`, etc.
- Check available models: `curl http://localhost:4141/v1/models`

### gemini-cli Still Using Google's Servers

**Problem:** Environment variable not set correctly

**Solution:**
```bash
# Check if variable is set
echo $GOOGLE_GEMINI_BASE_URL

# If empty, set it again
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"

# Test immediately in the same terminal
gemini "test"
```

## How It Works

```
┌──────────┐         ┌─────────────┐         ┌─────────┐
│  gemini  │ Gemini  │   copilot   │ OpenAI  │ GitHub  │
│   -cli   │ ──────> │     -api    │ ──────> │ Copilot │
└──────────┘  API    └─────────────┘  format └─────────┘
                         (proxy)
```

1. **gemini-cli** sends requests in Gemini API format to the URL specified in `GOOGLE_GEMINI_BASE_URL`
2. **copilot-api** receives the Gemini format request
3. **copilot-api** translates it to OpenAI format
4. **copilot-api** forwards to GitHub Copilot (using your authentication)
5. Response flows back: Copilot → OpenAI format → Gemini format → gemini-cli

## Features Supported

✅ Text generation and chat
✅ Multi-turn conversations
✅ System instructions
✅ Temperature, topP, maxTokens
✅ Stop sequences
✅ Function calling / Tools
✅ Images (inline data)
✅ Token usage tracking

⏳ Streaming (coming soon)

## Example Use Cases

### Code Generation
```bash
gemini "Write a REST API endpoint in Express.js for user authentication"
```

### Code Explanation
```bash
gemini "Explain this code: async function fetchData() { ... }"
```

### Debugging
```bash
gemini "Why am I getting 'TypeError: Cannot read property' in this code?"
```

### With Files
```bash
# gemini-cli supports file input
gemini "@mycode.js Refactor this to use async/await"
```

## Security Notes

- copilot-api stores your GitHub token locally (in `~/.local/share/copilot-api/`)
- The proxy runs locally - requests don't go through third-party servers
- Your code and prompts are sent to GitHub Copilot (subject to GitHub's privacy policy)

## Stopping the Proxy

When you're done, stop copilot-api with `Ctrl+C` in the terminal where it's running.

To stop using the proxy, unset the environment variable:

```bash
unset GOOGLE_GEMINI_BASE_URL
```

Then gemini-cli will use Google's Gemini API again (requires Google API key).

## Getting Help

- copilot-api issues: https://github.com/ericc-ch/copilot-api/issues
- gemini-cli issues: https://github.com/google-gemini/gemini-cli/issues
- Check copilot-api logs for debugging (they show request/response translations)
