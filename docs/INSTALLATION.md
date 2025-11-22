# Installing copilot-api Locally with Bun

This guide shows how to install and run the modified copilot-api (with Gemini support) locally using Bun.

## Prerequisites

- **Bun** installed (https://bun.sh)
- **GitHub Copilot subscription** (Individual, Business, or Enterprise)
- **Git** for cloning the repository

## Installation Steps

### 1. Navigate to the Project Directory

```bash
cd /home/hayua/copilot-api
```

### 2. Install Dependencies

```bash
bun install
```

This will:
- Install all required packages
- Set up git hooks
- Take ~1 second

### 3. Build the Project

```bash
bun run build
```

This will:
- Compile TypeScript to JavaScript
- Generate the executable in `dist/main.js`
- Take ~50ms

### 4. Run copilot-api

You have several options to run the server:

#### Option A: Development Mode (with auto-reload)
```bash
bun run dev
```
- Watches for file changes
- Auto-reloads on changes
- Good for development

#### Option B: Production Mode
```bash
bun run start
```
- Runs the built version
- No auto-reload
- Good for actual use

#### Option C: Direct Execution
```bash
./dist/main.js start
```
- Runs the compiled executable directly
- Same as production mode

### 5. Authenticate with GitHub

When you run for the first time, copilot-api will:
1. Open your browser automatically
2. Ask you to authenticate with GitHub
3. Request access to GitHub Copilot
4. Save your credentials locally

Follow the on-screen instructions to complete authentication.

## Quick Start Commands

```bash
# Full setup from scratch
cd /home/hayua/copilot-api
bun install
bun run build
bun run start

# In a new terminal, configure gemini-cli
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
gemini "Hello from Copilot!"
```

## Available Commands

### Authentication
```bash
# Just authenticate without starting server
./dist/main.js auth
```

### Start Server
```bash
# Start with default settings (port 4141)
./dist/main.js start

# Start on custom port
./dist/main.js start --port 8080

# Start with rate limiting (5 seconds between requests)
./dist/main.js start --rate-limit 5

# Start with manual approval for each request
./dist/main.js start --manual

# Specify account type (affects rate limits)
./dist/main.js start --account-type business
```

### Check Usage
```bash
# View your Copilot API usage
./dist/main.js check-usage
```

### Debug Information
```bash
# Print debug info
./dist/main.js debug
```

## Running Tests

```bash
# Run all tests
bun test

# Run tests with watch mode
bun test --watch

# Run specific test file
bun test tests/gemini-translation.test.ts
```

## Project Scripts

The `package.json` includes these scripts:

```bash
bun run build       # Build the project
bun run dev         # Development mode with auto-reload
bun run start       # Production mode
bun run typecheck   # Type check without building
bun run lint        # Lint the code
bun run lint:all    # Lint all files
```

## Verifying Installation

### 1. Check the server is running
```bash
curl http://localhost:4141/
# Should return: "Server running"
```

### 2. Check available models
```bash
curl http://localhost:4141/v1/models
```

### 3. Test Gemini endpoint
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

### 4. Test with gemini-cli
```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
gemini "What is 2+2?"
```

## File Structure After Installation

```
copilot-api/
├── dist/                    # Built files (after bun run build)
│   ├── main.js             # Executable
│   └── main.js.map         # Source map
├── node_modules/           # Dependencies (after bun install)
├── src/                    # Source code
│   └── routes/gemini/      # Gemini support (NEW)
├── tests/                  # Test files
├── package.json
├── bun.lockb              # Bun lockfile
└── tsconfig.json
```

## Configuration Files

### Server Configuration

copilot-api stores configuration in:
```
~/.local/share/copilot-api/
```

This includes:
- GitHub authentication tokens
- Copilot API tokens
- Usage statistics

### gemini-cli Configuration

Set the environment variable permanently:

**Bash** (`~/.bashrc`):
```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
```

**Zsh** (`~/.zshrc`):
```bash
export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"
```

**Fish** (`~/.config/fish/config.fish`):
```bash
set -x GOOGLE_GEMINI_BASE_URL "http://localhost:4141"
```

## Updating the Code

If you make changes to the source code:

```bash
# 1. Make your changes in src/

# 2. Run tests
bun test

# 3. Type check
bun run typecheck

# 4. Rebuild
bun run build

# 5. Restart the server
# (Ctrl+C to stop, then)
bun run start
```

Or use development mode for auto-reload:
```bash
bun run dev
# Changes are automatically reloaded
```

## Troubleshooting

### "command not found: bun"

**Solution:** Make sure Bun is in your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
# Or add to your ~/.bashrc or ~/.zshrc
```

### Port Already in Use

**Problem:** Port 4141 is already in use

**Solution:** Use a different port:
```bash
./dist/main.js start --port 8080
export GOOGLE_GEMINI_BASE_URL="http://localhost:8080"
```

### Build Errors

**Problem:** TypeScript compilation fails

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules bun.lockb dist
bun install
bun run build
```

### Authentication Issues

**Problem:** "Copilot token not found"

**Solution:**
```bash
# Re-authenticate
./dist/main.js auth

# Or remove saved credentials and re-auth
rm -rf ~/.local/share/copilot-api
./dist/main.js start
```

## Uninstalling

To remove copilot-api:

```bash
# Remove the project directory
cd ~
rm -rf /home/hayua/copilot-api

# Remove configuration
rm -rf ~/.local/share/copilot-api

# Unset environment variable
unset GOOGLE_GEMINI_BASE_URL
# (and remove from ~/.bashrc or ~/.zshrc)
```

## Performance

- **Build time:** ~50ms
- **Install time:** ~1 second
- **Test time:** ~124ms (37 tests)
- **Startup time:** ~100ms
- **Memory usage:** ~50MB

## Next Steps

After installation:

1. **Read the setup guide:** See `GEMINI_SETUP.md` for detailed usage instructions
2. **Read technical docs:** See `GEMINI_TECH_SPECS.md` for implementation details
3. **Start the server:** `bun run start`
4. **Configure gemini-cli:** `export GOOGLE_GEMINI_BASE_URL="http://localhost:4141"`
5. **Start using it:** `gemini "Your prompt here"`

## Getting Help

- **Test your changes:** `bun test`
- **Check types:** `bun run typecheck`
- **View logs:** copilot-api shows detailed debug logs in the console
- **Issues:** https://github.com/ericc-ch/copilot-api/issues

Enjoy using gemini-cli with GitHub Copilot! 🚀
