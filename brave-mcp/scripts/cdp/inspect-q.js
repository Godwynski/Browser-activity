import CDP from 'chrome-remote-interface';

let client;
try {
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.url.includes('cyberq.eccouncil.org')) || targets[0];
  client = await CDP({ target, port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();

  const expr = `
    (() => {
      var spans = Array.from(document.querySelectorAll('span, td, div, p')).map(e => ({
        id: e.id,
        className: e.className,
        text: (e.innerText || '').trim()
      })).filter(e => e.text.length > 20 && e.text.length < 500 && !e.text.includes('Copyright'));
      return spans.slice(0, 15);
    })()
  `;

  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log('Text blocks:', JSON.stringify(res.result.value, null, 2));
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
