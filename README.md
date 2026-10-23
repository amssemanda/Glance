<p align="center"><img src="assets/icon.png" width="128" alt="Glance icon"></p>

<h1 align="center">Glance</h1>

A small AI helper that floats on top of your other windows. It can:

- **Answer questions about your screen.** Press a shortcut and Glance looks at your screen and answers your question about it.
- **Listen to your calls.** It writes down what's being said as you talk.
- **Suggest what to say.** It gives you reply ideas and follow-up questions from the conversation.

Glance shows up normally when you share your screen. It isn't hidden.

## Download (Windows)

**[Download Glance for Windows](https://github.com/tttppp352-cpu/Glance/releases/latest/download/Glance-Setup-0.1.0.exe)**

1. Open the downloaded file.
2. If Windows says **"Windows protected your PC"**, click **More info**, then **Run anyway**. This shows up because the app isn't code-signed. It doesn't mean the app is unsafe.
3. Glance installs and opens by itself. Next time, find it in the Start menu.

## Set it up (free, about 5 minutes)

Glance needs two free keys, which are like passwords for the AI services. Neither needs a credit card.

1. **Chat key:** sign up at https://openrouter.ai and create a key at https://openrouter.ai/keys.
2. **Listening key:** sign up at https://console.groq.com and create a key at https://console.groq.com/keys.
3. In Glance, click the **gear icon** and set:
   - **Provider:** OpenRouter, then paste your OpenRouter key
   - **Speech-to-text provider:** Groq, then paste your Groq key
4. Click **Save**.

Your keys are stored encrypted on your computer and only sent to those two services.

## How to use it

| Press | What it does |
| --- | --- |
| `Ctrl+Shift+Enter` | Ask about your screen (type a question first, or leave it empty) |
| `Ctrl+Shift+L` | Start/stop listening |
| `Ctrl+Shift+K` | Suggest what to say next |
| `Ctrl+Shift+Space` | Show/hide Glance |
| `Ctrl+Shift+X` | Let clicks pass through Glance to the window behind |
| `Esc` | Stop an answer |

You can also type a question in the box and press **Enter**. On a Mac, use `Cmd` instead of `Ctrl`. Turn on **Auto-suggest when a question is heard** in Settings to get suggestions without pressing anything.

**Tip:** to get suggestions with your real details (prices, products, your role), write them under **Custom instructions** in Settings. Otherwise Glance leaves blanks like `[price]` and doesn't guess.

## Good to know

- **Free limits:** the free AI services have daily limits. If you get a "rate limited" message, wait a bit and try again.
- **Privacy:** Glance doesn't save your chats, transcripts or screenshots. They disappear when you close it. Only your settings are saved. Screenshots and audio go to OpenRouter and Groq when you use those features.
- **Hearing the other person on a call:** on Windows, turn on **Also capture system audio (Windows)** in Settings. On Mac, Glance hears only your microphone unless you set up a tool like BlackHole.
- **Mac:** the first time, allow **Screen Recording** and **Microphone** for Glance in System Settings → Privacy & Security, then reopen it.

---

## For developers

Run from source (needs [Node.js](https://nodejs.org)):

```bash
git clone https://github.com/tttppp352-cpu/Glance.git
cd Glance
npm install
npm start
```

- `npm test`: unit tests and API integration tests against a mock server
- `npm run mock`: OpenAI-compatible mock API at `http://localhost:8787/v1`, so you can try it without keys
- `npm run dist`: build an installer for your OS into `dist/`

Glance works with any OpenAI-compatible API (OpenAI, OpenRouter, Ollama, LM Studio, …). Pick **Custom** in Settings and enter the Base URL. Setting `OPENAI_API_KEY` in the environment works too.

Code layout:
- `main.js`: window, shortcuts, screen capture
- `src/llm.js`: chat and speech-to-text client
- `src/prompts.js`: AI instructions
- `src/settings.js`: settings storage (keys encrypted with the OS keychain)
- `renderer/`: the overlay UI and audio recorder
