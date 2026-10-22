// OpenAI-compatible mock for local testing without an API key:
//   npm run mock   then set Base URL to http://localhost:8787/v1 in Settings.
const http = require('http');

const PORT = Number(process.env.PORT || 8787);

function reply(messages) {
  const last = messages[messages.length - 1];
  const parts = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }];
  const hasImage = parts.some((p) => p.type === 'image_url');
  const text = parts.find((p) => p.type === 'text')?.text || '';
  return [
    `**Mock answer** (${hasImage ? 'with screenshot' : 'no screenshot'}, ${messages.length} messages)`,
    '',
    `- You asked: ${text.split('\n').pop().slice(0, 80)}`,
    '- Code sample:',
    '',
    '```js',
    'console.log("hello from the mock");',
    '```',
  ].join('\n');
}

const server = http.createServer((req, res) => {
  let body = [];
  req.on('data', (c) => body.push(c));
  req.on('end', async () => {
    body = Buffer.concat(body);
    if (req.url.endsWith('/chat/completions')) {
      const { messages } = JSON.parse(body.toString());
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const word of reply(messages).split(/(?<=\s)/)) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
        await new Promise((r) => setTimeout(r, 15));
      }
      res.end('data: [DONE]\n\n');
    } else if (req.url.endsWith('/audio/transcriptions')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: `[mock transcript of ${body.length} bytes] What is your pricing?` }));
    } else {
      res.writeHead(404).end();
    }
  });
});

if (require.main === module) server.listen(PORT, () => console.log(`Mock API on http://localhost:${PORT}/v1`));
module.exports = server;
