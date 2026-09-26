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
      __doPostBack('ctl00$ContentPlaceHolder1$rptrForms$ctl05$lbtnFormid', '');
      return 'Navigating to Module 06';
    })()
  `;

  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log('Postback result:', res.result.value);
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
