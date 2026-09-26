import CDP from 'chrome-remote-interface';

const btnId = process.argv[2] || 'ctl00_ContentPlaceHolder1_rptrSections_ctl04_btnStartTest';

let client;
try {
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.url.includes('cyberq.eccouncil.org')) || targets[0];
  client = await CDP({ target, port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();

  const expr = `
    (() => {
      var btn = document.getElementById('${btnId}');
      if (btn) {
        btn.click();
        return 'Clicked ' + btn.id;
      }
      return 'Button not found: ${btnId}';
    })()
  `;

  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log('Start result:', res.result.value);
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
