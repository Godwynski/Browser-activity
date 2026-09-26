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
      var rows = Array.from(document.querySelectorAll('[id*="rptrSections_ctl"]'));
      var seen = {}, list = [];
      rows.forEach(function(el) {
        var m = el.id.match(/rptrSections_(ctl\\d+)/);
        if (!m || seen[m[1]]) return;
        seen[m[1]] = true;
        var key = m[1];
        var parent = el.closest('tr') || el.closest('.row') || el.parentElement;
        list.push({
          key: key,
          text: parent ? parent.innerText.trim().replace(/\\s+/g, ' ') : el.innerText
        });
      });
      return list;
    })()
  `;

  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log('Sections details:', JSON.stringify(res.result.value, null, 2));
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
