import { BraveManager } from '../src/browser.js';
import { BrowserObserver } from '../src/observer.js';

async function sendHello() {
  console.log("Connecting to Brave...");
  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  const pages = await brave.getPages();
  const page = pages.find(p => p.url().includes('facebook.com/messages')) || pages[0];
  console.log(`Found Facebook page: "${await page.title()}" at ${page.url()}`);

  // Find message input box
  console.log("Locating message input field...");
  const inputLocator = page.locator('div[role="textbox"][contenteditable="true"], div[aria-label*="Message"], div[role="textbox"]').last();
  await inputLocator.waitFor({ state: 'visible', timeout: 10000 });

  console.log("Focusing message input...");
  await inputLocator.click();
  await page.waitForTimeout(300);

  console.log("Typing 'hello'...");
  await inputLocator.fill('hello');
  await page.waitForTimeout(400);

  console.log("Pressing Enter to send...");
  await inputLocator.press('Enter');
  await page.waitForTimeout(2000);

  // Verify message was sent
  const lastMessages = await page.evaluate(() => {
    const textNodes = Array.from(document.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
    return textNodes.map(el => el.innerText.trim()).filter(t => t.length > 0).slice(-10);
  });
  console.log("Recent messages in conversation:", JSON.stringify(lastMessages, null, 2));

  const hasHello = lastMessages.some(m => m.toLowerCase() === 'hello');
  if (hasHello) {
    console.log("✅ Message 'hello' sent to Asteroid Destroyer successfully!");
  } else {
    console.log("Message sent, checking recent text nodes:", lastMessages);
  }
}

sendHello().catch(console.error);
