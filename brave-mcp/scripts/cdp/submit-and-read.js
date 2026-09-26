import CDP from 'chrome-remote-interface';

const idx = process.argv[2];
if (idx === undefined) {
  console.error('Usage: node submit-and-read.js <index 0-3>');
  process.exit(1);
}

let client;
try {
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.url.includes('cyberq.eccouncil.org')) || targets[0];
  client = await CDP({ target, port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();

  const submitExpr = `
    (() => {
      var r = document.getElementById('rbtnOptions_${idx}');
      if (r) {
        r.checked = true;
        r.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var btn = document.getElementById('btnAnswer');
      if (btn) {
        btn.click();
        return 'Clicked btnAnswer with option ${idx}';
      }
      return 'btnAnswer not found';
    })()
  `;

  await Runtime.evaluate({ expression: submitExpr, returnByValue: true });

  // wait 1.2s for navigation / postback
  await new Promise(r => setTimeout(r, 1200));

  const readExpr = `
    (() => {
      var url = window.location.href;
      if (url.includes('ProgressiveResult')) {
        return { state: 'result' };
      }
      var bodyText = document.body.innerText;
      if (bodyText.includes('completed the assessment for this topic')) {
        return { state: 'done' };
      }
      var qEl = document.getElementById('lblQuestion');
      var qText = qEl ? qEl.innerText.trim() : '';
      var opts = Array.from(document.querySelectorAll('input[type="radio"]')).map(function(r) {
        var lbl = document.querySelector('label[for="' + r.id + '"]');
        return { idx: r.id.replace('rbtnOptions_', ''), text: lbl ? lbl.innerText.trim() : r.value };
      });
      return { state: 'question', q: qText, opts: opts };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: readExpr, returnByValue: true });
  console.log('Next State:\n', JSON.stringify(res.result.value, null, 2));
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
