const trimSlash = (url) => url.replace(/\/+$/, '');

async function request(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(`Could not reach ${new URL(url).origin} (${err.cause?.code || err.cause?.message || err.message}). Check Base URL and your connection.`);
  }
}

async function* parseSSE(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {}
    }
  }
}

async function errorText(res) {
  const text = await res.text();
  try {
    const { error } = JSON.parse(text);
    return error?.metadata?.raw || error?.message || text;
  } catch {
    return text;
  }
}

// `model` may be a comma-separated list; extra entries are sent as OpenRouter fallbacks.
function modelParams(model) {
  const models = model.split(',').map((m) => m.trim()).filter(Boolean);
  return models.length > 1 ? { model: models[0], models } : { model: models[0] };
}

async function* streamChat({ baseUrl, apiKey, model, messages, signal }) {
  const res = await request(`${trimSlash(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ ...modelParams(model), messages, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error(`Chat request failed (${res.status}): ${await errorText(res)}`);
  yield* parseSSE(res.body);
}

async function transcribe({ baseUrl, apiKey, model, audio, mime }) {
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mime }), 'audio.webm');
  form.append('model', model);
  const res = await request(`${trimSlash(baseUrl)}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await errorText(res)}`);
  return ((await res.json()).text || '').trim();
}

module.exports = { streamChat, transcribe, parseSSE, modelParams };
