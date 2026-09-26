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
      var btn = document.getElementById('ctl00_ContentPlaceHolder1_rptrSections_ctl03_btnRetakeTest');
      if (btn) {
        btn.click();
        return 'Clicked ctl03_btnRetakeTest';
      }
      return 'Button not found';
    })()
  `;

  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log('Click result:', res.result.value);
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
