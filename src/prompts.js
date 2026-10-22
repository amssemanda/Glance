const BASE = `You are Glance, a real-time assistant shown in a small always-on-top overlay.
Be brief and scannable: lead with the answer, then short bullets. Use fenced code blocks for code.
If a screenshot is attached, it shows the user's current screen; ground your answer in it.
If a conversation transcript is provided, it is a live, imperfect speech-to-text log of the user's call.
Never invent specifics about the user, their company or their products (prices, plans, trial lengths, dates, numbers, policies).
Only state such facts if they appear in the transcript, screenshot or user instructions; otherwise use a placeholder like [your trial length] or suggest asking/checking.`;

const SCREEN_DEFAULT = 'Look at my screen. Figure out what I am most likely working on or being asked, and help me with it.';

const MAX_TRANSCRIPT_CHARS = 6000;
const MAX_HISTORY_TURNS = 10;

function buildMessages({ question, screenshot, transcript, history = [], customInstructions = '' }) {
  const system = customInstructions ? `${BASE}\n\nUser instructions:\n${customInstructions}` : BASE;
  const messages = [{ role: 'system', content: system }];

  for (const turn of history.slice(-MAX_HISTORY_TURNS)) {
    if (turn.content) messages.push({ role: turn.role, content: turn.content });
  }

  let text = question?.trim() || (screenshot ? SCREEN_DEFAULT : '');
  if (transcript?.trim()) {
    text = `Live transcript (most recent last):\n"""\n${transcript.slice(-MAX_TRANSCRIPT_CHARS)}\n"""\n\n${text}`;
  }

  const content = [{ type: 'text', text }];
  if (screenshot) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot}`, detail: 'high' } });
  }
  messages.push({ role: 'user', content });
  return messages;
}

module.exports = { buildMessages, SCREEN_DEFAULT };
