import { BraveManager } from '../../src/browser.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Connecting to Brave...');
  const brave = new BraveManager('http://127.0.0.1:9222');
  const browser = await brave.ensureConnected();
  const pages = await brave.getPages();
  const page = pages[0] || await browser.contexts()[0].newPage();

  console.log('🌐 Ensuring on Instagram...');
  if (!page.url().includes('instagram.com')) {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  // Load saved report
  const reportPath = path.resolve('artifacts', 'instagram_not_following_back.json');
  if (!fs.existsSync(reportPath)) {
    console.error('❌ Could not find artifacts/instagram_not_following_back.json');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const prevUnfollowed = new Set((report.unfollowAction?.unfollowed || []).map(u => u.username.toLowerCase()));
  const notFollowingBack = report.notFollowingBack || [];

  // Filter remaining targets: non-followers, excluding @_urfavhc and already unfollowed
  const remainingTargets = notFollowingBack.filter(u => {
    const lname = u.username.toLowerCase();
    return lname !== '_urfavhc' && !prevUnfollowed.has(lname);
  });

  console.log(`📋 Total non-followers: ${notFollowingBack.length}`);
  console.log(`✅ Already unfollowed: ${prevUnfollowed.size}`);
  console.log(`🎯 Remaining targets to unfollow: ${remainingTargets.length}`);

  if (remainingTargets.length === 0) {
    console.log('🎉 All target accounts have already been unfollowed!');
    process.exit(0);
  }

  console.log('\n⏳ Pausing 10s to ensure rate limits are clear, then executing remaining batch...\n');
  await new Promise(r => setTimeout(r, 10000));

  const results = await page.evaluate(async (targetList) => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const unfollowed = [];
    const failed = [];

    for (let i = 0; i < targetList.length; i++) {
      const user = targetList[i];
      const url = `https://www.instagram.com/web/friendships/${user.pk}/unfollow/`;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers
        });

        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch (e) {}

        if (res.ok && data.status === 'ok') {
          unfollowed.push({ username: user.username, pk: user.pk, status: 'success' });
          console.log(`[${i + 1}/${targetList.length}] Unfollowed @${user.username}`);
        } else {
          failed.push({ username: user.username, pk: user.pk, httpStatus: res.status, error: text.slice(0, 200) });
          console.warn(`[${i + 1}/${targetList.length}] Failed @${user.username}: status=${res.status}`);
        }
      } catch (err) {
        failed.push({ username: user.username, pk: user.pk, error: err.message });
      }

      // Safe relaxed delay (6s - 10s) for remaining batch
      const delay = Math.floor(Math.random() * 4000) + 6000;
      await sleep(delay);
    }

    return { unfollowed, failed };
  }, remainingTargets);

  const allUnfollowed = [...Array.from(prevUnfollowed).map(u => ({ username: u, status: 'success' })), ...results.unfollowed];

  console.log('\n=============================================');
  console.log('🎉 UNFOLLOW PROCESS COMPLETED!');
  console.log(`- New Unfollowed: ${results.unfollowed.length}/${remainingTargets.length}`);
  console.log(`- Total Unfollowed Overall: ${allUnfollowed.length}/25`);
  console.log(`- Remaining Failed: ${results.failed.length}`);
  console.log('=============================================\n');

  // Update artifacts report
  const updatedReport = {
    ...report,
    unfollowAction: {
      timestamp: new Date().toISOString(),
      kept: ['_urfavhc'],
      totalUnfollowedCount: allUnfollowed.length,
      unfollowed: allUnfollowed,
      failed: results.failed
    }
  };
  fs.writeFileSync(reportPath, JSON.stringify(updatedReport, null, 2));
  console.log(`💾 Saved updated report to: ${reportPath}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error executing unfollow script:', err);
  process.exit(1);
});
