const test = require('node:test');
const assert = require('node:assert');
const server = require('./mock-server');
const { streamChat, transcribe, parseSSE, modelParams } = require('../src/llm');
const { buildMessages } = require('../src/prompts');

test('parseSSE handles split chunks and [DONE]', async () => {
  const enc = new TextEncoder();
  async function* body() {
    yield enc.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\nda');
    yield enc.encode('ta: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n');
    yield enc.encode('data: {"choices":[{"delta":{"content":"ignored"}}]}\n\n');
  }
  let out = '';
  for await (const d of parseSSE(body())) out += d;
  assert.strictEqual(out, 'Hello');
});

test('modelParams splits fallback lists', () => {
  assert.deepStrictEqual(modelParams('gpt-4o-mini'), { model: 'gpt-4o-mini' });
  assert.deepStrictEqual(modelParams('a, b ,c'), { model: 'a', models: ['a', 'b', 'c'] });
});

test('buildMessages attaches screenshot and transcript', () => {
  const msgs = buildMessages({
    question: '',
    screenshot: 'AAAA',
    transcript: 'they asked about pricing',
    history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
    customInstructions: 'Be nice',
  });
  assert.strictEqual(msgs[0].role, 'system');
  assert.match(msgs[0].content, /Be nice/);
  assert.strictEqual(msgs.length, 4);
  const last = msgs.at(-1).content;
  assert.match(last[0].text, /pricing/);
  assert.match(last[0].text, /Look at my screen/);
  assert.strictEqual(last[1].image_url.url, 'data:image/jpeg;base64,AAAA');
});

test('streamChat and transcribe work against an OpenAI-compatible API', async (t) => {
  await new Promise((r) => server.listen(0, r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const baseUrl = `http://localhost:${server.address().port}/v1/`;

  let out = '';
  const messages = buildMessages({ question: 'ping', screenshot: 'AAAA' });
  for await (const d of streamChat({ baseUrl, apiKey: 'x', model: 'm', messages })) out += d;
  assert.match(out, /with screenshot/);
  assert.match(out, /You asked: ping/);

  const text = await transcribe({ baseUrl, apiKey: 'x', model: 'm', audio: Buffer.from('abc'), mime: 'audio/webm' });
  assert.match(text, /What is your pricing\?/);
});
