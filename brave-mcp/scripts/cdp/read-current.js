import fs from 'fs';
import CDP from 'chrome-remote-interface';

let client;
try {
  const targets = await CDP.List({ port: 9222 });
  const target = targets.find(t => t.url.includes('cyberq.eccouncil.org')) || targets[0];
  client = await CDP({ target, port: 9222 });
  const { Runtime } = client;
  await Runtime.enable();

  const runnerCode = fs.readFileSync('scripts/cdp/cyberq-runner.js', 'utf8');
  const match = runnerCode.match(/\(function readState\(\) \{[\s\S]*?\}\)\(\);/);
  
  const res = await Runtime.evaluate({ expression: match[0], returnByValue: true });
  console.log('Current State:\n', JSON.stringify(res.result.value, null, 2));
} catch (err) {
  console.error('Error:', err);
} finally {
  if (client) await client.close();
}
