// Minimal, safe markdown renderer for assistant replies (escapes all HTML first).
(function () {
  const escape = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

  function render(md) {
    const parts = md.split(/```/);
    let html = '';
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        const code = part.replace(/^[\w+-]*\n/, '');
        html += `<pre><code>${escape(code)}</code></pre>`;
        return;
      }
      let list = null;
      const close = () => {
        if (list) html += `</${list}>`;
        list = null;
      };
      for (const raw of escape(part).split('\n')) {
        const line = raw.trimEnd();
        const ul = line.match(/^\s*[-*•]\s+(.*)/);
        const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
        const h = line.match(/^#{1,6}\s+(.*)/);
        if (ul || ol) {
          const type = ul ? 'ul' : 'ol';
          if (list !== type) {
            close();
            html += `<${type}>`;
            list = type;
          }
          html += `<li>${inline((ul || ol)[1])}</li>`;
        } else {
          close();
          if (h) html += `<p><strong>${inline(h[1])}</strong></p>`;
          else if (line.trim()) html += `<p>${inline(line)}</p>`;
        }
      }
      close();
    });
    return html;
  }

  window.renderMarkdown = render;
})();
