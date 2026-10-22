# Glance

An always-on-top AI copilot overlay for your desktop (similar to Cluely, but the overlay is **not** hidden from screen sharing).

- **Ask about your screen**: press a hotkey to take a screenshot and send it, with your question, to a vision model. The answer streams back.
- **Live transcription**: records your mic (and system audio on Windows) in 6-second chunks and transcribes them. Silent chunks are skipped.
- **Suggested replies**: get "say next", facts, and follow-up questions from the live transcript, on demand or automatically when someone asks a question.
- **Chat**: follow-up questions keep context. Answers render as markdown with code blocks.
- **Overlay controls**: frameless, translucent, draggable, and resizable. Click-through mode lets you work through it.
- **Any OpenAI-compatible API**: OpenAI by default. You can point Base URL at OpenRouter, Groq, a local Ollama/LM Studio, and so on.

## Run

```bash
npm install
npm start
```

On first launch, open Settings (gear icon) and paste your API key. Alternatively, start the app with `OPENAI_API_KEY` set in the environment.

### Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+Shift+Enter` | Ask about the screen (uses any text typed in the box as the question) |
| `Ctrl/Cmd+Shift+L` | Start/stop listening |
| `Ctrl/Cmd+Shift+K` | Suggest what to say from the transcript |
| `Ctrl/Cmd+Shift+Space` | Show/hide the overlay |
| `Ctrl/Cmd+Shift+X` | Toggle click-through |
| `Esc` | Stop the current answer |

### Permissions

- **macOS**: grant Screen Recording and Microphone access in System Settings → Privacy & Security, then restart the app.
- **System audio** (the other side of a call): captured via loopback on Windows only. On macOS/Linux, route call audio through a virtual device (e.g. BlackHole, PulseAudio monitor) and select it as the input.

## Try it without an API key

```bash
npm run mock      # OpenAI-compatible mock on http://localhost:8787/v1
```

Then set Base URL to `http://localhost:8787/v1` in Settings.

## Test / package

```bash
npm test          # unit + API integration tests against the mock
npm run dist      # build an installer for the current OS into dist/
```

## Layout

- `main.js`: window, global shortcuts, screen capture, IPC
- `src/llm.js`: streaming chat + transcription client (OpenAI-compatible)
- `src/prompts.js`: system prompt and message building
- `src/settings.js`: settings persistence (API key encrypted with OS keychain via `safeStorage` when available)
- `renderer/`: overlay UI, audio recorder, and a tiny markdown renderer
