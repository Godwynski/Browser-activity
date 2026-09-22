import { BraveManager } from '../../src/browser.js';

async function test() {
  const brave = new BraveManager('http://127.0.0.1:9222');
  const browser = await brave.ensureConnected();
  const pages = await brave.getPages();
  const page = pages[0] || await browser.contexts()[0].newPage();

  if (!page.url().includes('instagram.com')) {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Test target: @foodpanda_ph (pk: 1340695132)
  const testPk = '1340695132';

  const res = await page.evaluate(async (pk) => {
    const cookies = document.cookie.split('; ').reduce((acc, str) => {
      const [k, v] = str.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const csrftoken = cookies['csrftoken'];

    const headers = {
      'x-csrftoken': csrftoken,
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-requested-with': 'XMLHttpRequest',
      'content-type': 'application/x-www-form-urlencoded'
    };

    const tests = {};

    // Test 1: web endpoint
    try {
      const r1 = await fetch(`https://www.instagram.com/web/friendships/${pk}/unfollow/`, {
        method: 'POST',
        headers
      });
      tests.web_endpoint = { status: r1.status, text: (await r1.text()).slice(0, 300) };
    } catch (e) {
      tests.web_endpoint = { error: e.message };
    }

    // Test 2: api/v1 destroy endpoint with body
    try {
      const r2 = await fetch(`https://www.instagram.com/api/v1/friendships/destroy/${pk}/`, {
        method: 'POST',
        headers,
        body: `container_module=profile&nav_chain=null&user_id=${pk}`
      });
      tests.api_destroy_endpoint = { status: r2.status, text: (await r2.text()).slice(0, 300) };
    } catch (e) {
      tests.api_destroy_endpoint = { error: e.message };
    }

    return tests;
  }, testPk);

  console.log('Test results:', JSON.stringify(res, null, 2));
  process.exit(0);
}

test().catch(console.error);
