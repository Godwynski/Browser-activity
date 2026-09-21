import { BraveManager } from '../src/browser.js';
import { BrowserObserver } from '../src/observer.js';
import { ActionEngine } from '../src/actions.js';
import { StateVerifier } from '../src/verifier.js';

async function main() {
  console.log("Connecting to Brave with Personal Profile...");
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages[0];
  console.log(`Current active page URL: ${page.url()}`);

  console.log("Navigating to Facebook Messages...");
  await page.goto('https://www.facebook.com/messages', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log(`Navigated! Page Title: "${await page.title()}", URL: ${page.url()}`);

  const observer = new BrowserObserver();
  const obs = await observer.observe(page, { includeScreenshot: false, maxElements: 100 });
  console.log(`Observation complete: ${obs.elements.length} elements found.`);

  // Search for asteroid destroyer
  const matches = obs.elements.filter(e => (e.name || '').toLowerCase().includes('asteroid') || (e.name || '').toLowerCase().includes('destroyer'));
  console.log("Asteroid matches in observation:", JSON.stringify(matches, null, 2));

  // Also query page text directly via evaluate
  const textMatches = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const found = [];
    for (const el of els) {
      if (el.children.length === 0 && (el.innerText || '').toLowerCase().includes('asteroid')) {
        found.push({ tag: el.tagName, text: el.innerText.trim(), role: el.getAttribute('role') });
      }
    }
    return found.slice(0, 10);
  });
  console.log("Direct DOM text matches:", JSON.stringify(textMatches, null, 2));
}

main().catch(console.error);
