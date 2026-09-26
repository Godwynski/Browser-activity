import CDP from 'chrome-remote-interface';

let client;
try {
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.url.includes('cyberq.eccouncil.org')) || targets[0];
  client = await CDP({ target, port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();

  const handleDoneExpr = `
    (() => {
      var btns = Array.from(document.querySelectorAll('input[type="submit"], button, .btn'));
      var ok = btns.find(b => (b.value || b.innerText || '').match(/OK|Continue/i));
      if (ok) {
        ok.click();
        return 'Clicked OK';
      }
      return 'No OK button found';
    })()
  `;

  const res = await Runtime.evaluate({ expression: handleDoneExpr, returnByValue: true });
  console.log('Done click result:', res.result.value);

  // Wait 2.5s for page transition to ProgressiveResult.aspx
  await new Promise(r => setTimeout(r, 2500));

  const proceedExpr = `
    (() => {
      var rt = document.body.innerText;
      var els = Array.from(document.querySelectorAll('a, input[type="submit"], button'));
      var proceed = els.find(e => (e.innerText || e.value || '').match(/PROCEED/i));
      var info = {
        url: window.location.href,
        textSnippet: rt.slice(0, 300).replace(/\\s+/g, ' '),
        hasProceed: !!proceed
      };
      if (proceed) {
        proceed.click();
        info.action = 'Clicked PROCEED WITH NEXT TOPIC';
      }
      return info;
    })()
  `;

  const nextRes = await Runtime.evaluate({ expression: proceedExpr, returnByValue: true });
  console.log('Result Page & Proceed:', JSON.stringify(nextRes.result.value, null, 2));
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
