# Configuring gemini-cli Model Selection for GitHub Copilot

## Supported Models

GitHub Copilot currently supports these Gemini models:
- **gemini-2.5-pro** (Recommended)
- **gemini-3-pro-preview**

## Configuration

### Option 1: Use Environment Variable (Recommended)

Set the default model for all gemini-cli requests:

```bash
export GOOGLE_GEMINI_MODEL="gemini-2.5-pro"
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
```

Make it permanent:

**Bash** (`~/.bashrc`):
```bash
echo 'export GOOGLE_GEMINI_MODEL="gemini-2.5-pro"' >> ~/.bashrc
echo 'export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"' >> ~/.bashrc
source ~/.bashrc
```

**Zsh** (`~/.zshrc`):
```bash
echo 'export GOOGLE_GEMINI_MODEL="gemini-2.5-pro"' >> ~/.zshrc
echo 'export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"' >> ~/.zshrc
source ~/.zshrc
```

### Option 2: Use CLI Flag

Specify the model per request:

```bash
gemini -m gemini-2.5-pro "Your prompt here"
```

Or for the preview model:

```bash
gemini -m gemini-3-pro-preview "Your prompt here"
```

### Option 3: Configuration File

Create or edit `~/.gemini/config.json`:

```json
{
  "model": "gemini-2.5-pro",
  "baseUrl": "http://localhost:4141"
}
```

## Testing Different Models

```bash
# Test gemini-2.5-pro
gemini -m gemini-2.5-pro "Write a haiku about code"

# Test gemini-3-pro-preview
gemini -m gemini-3-pro-preview "Explain async/await"
```

## Model Mapping

When you specify a Gemini model, copilot-api forwards the model name to GitHub Copilot:

```
gemini-cli Request          →  copilot-api  →  GitHub Copilot
model: gemini-2.5-pro              ↓             Uses: gemini-2.5-pro
model: gemini-3-pro-preview        ↓             Uses: gemini-3-pro-preview
```

## Complete Setup Example

```bash
# 1. Start copilot-api
cd /home/hayua/copilot-api
bun run start

# 2. In a new terminal, configure gemini-cli
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
export GOOGLE_GEMINI_MODEL="gemini-2.5-pro"

# 3. Test it
gemini "Hello from Gemini 2.5 Pro via Copilot!"
```

## Checking Current Configuration

```bash
# Check environment variables
echo "Base URL: $GOOGLE_GEMINI_BASE_URL"
echo "Model: $GOOGLE_GEMINI_MODEL"

# Test connection
gemini --help
```

## Troubleshooting

### Error: "Model not supported"

If you get a model error, ensure you're using one of the supported models:
- `gemini-2.5-pro`
- `gemini-3-pro-preview`

### Server logs show model name

Check copilot-api logs to see which model is being used:

```bash
# You should see in the logs:
Translated OpenAI request payload: {"model":"gemini-2.5-pro",...}
```

### Testing model availability

```bash
# Check what models Copilot supports
curl http://localhost:4141/v1/models
```

## Recommended Configuration

For best results, use:

```bash
# In ~/.bashrc or ~/.zshrc
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
export GOOGLE_GEMINI_MODEL="gemini-2.5-pro"
```

Then simply use:

```bash
gemini "Your prompt"
```

The model will automatically be `gemini-2.5-pro` through GitHub Copilot!

## Advanced: Per-Project Configuration

You can create project-specific configurations:

```bash
# In your project directory
cat > .env << 'EOF'
GOOGLE_GEMINI_BASE_URL=http://localhost:4141
GOOGLE_GEMINI_MODEL=gemini-2.5-pro
EOF

# Load it
source .env
gemini "Project-specific prompt"
```

## Model Differences

### gemini-2.5-pro
- Latest stable version
- Best for production use
- Good balance of speed and quality

### gemini-3-pro-preview
- Preview/experimental version
- May have newer features
- Potentially less stable

Choose `gemini-2.5-pro` unless you need specific features from the preview version.
