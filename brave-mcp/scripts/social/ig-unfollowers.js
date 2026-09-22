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

  console.log('🔍 Extracting all following and followers...');

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const cookies = document.cookie.split('; ').reduce((acc, str) => {
      const [k, v] = str.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const ds_user_id = cookies['ds_user_id'];
    const csrftoken = cookies['csrftoken'];

    const headers = {
      'x-csrftoken': csrftoken,
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '129477',
      'x-requested-with': 'XMLHttpRequest'
    };

    // Helper to fetch all pages
    async function fetchAll(type) {
      const items = [];
      let maxId = null;
      let pageNum = 1;

      while (true) {
        let url = `https://www.instagram.com/api/v1/friendships/${ds_user_id}/${type}/?count=50`;
        if (maxId) {
          url += `&max_id=${encodeURIComponent(maxId)}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`Failed to fetch ${type} on page ${pageNum}: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const users = data.users || [];
        for (const u of users) {
          items.push({
            pk: String(u.pk),
            username: u.username,
            full_name: u.full_name || '',
            is_private: !!u.is_private,
            is_verified: !!u.is_verified,
            profile_pic_url: u.profile_pic_url || ''
          });
        }

        if (!data.next_max_id || users.length === 0) {
          break;
        }

        maxId = data.next_max_id;
        pageNum++;
        await sleep(800); // 800ms throttle between requests
      }

      return items;
    }

    const following = await fetchAll('following');
    await sleep(1000);
    const followers = await fetchAll('followers');

    return {
      userId: ds_user_id,
      following,
      followers
    };
  });

  const { userId, following, followers } = result;

  console.log(`✅ Fetched ${following.length} Following accounts.`);
  console.log(`✅ Fetched ${followers.length} Followers.`);

  const followerUsernames = new Set(followers.map(f => f.username.toLowerCase()));
  const followerIds = new Set(followers.map(f => f.pk));

  // People you follow who do NOT follow you back
  const notFollowingBack = following.filter(u => {
    return !followerUsernames.has(u.username.toLowerCase()) && !followerIds.has(u.pk);
  });

  // People who follow you but you do NOT follow back
  const followingUsernames = new Set(following.map(f => f.username.toLowerCase()));
  const followingIds = new Set(following.map(f => f.pk));
  const fans = followers.filter(u => {
    return !followingUsernames.has(u.username.toLowerCase()) && !followingIds.has(u.pk);
  });

  // Mutuals
  const mutuals = following.filter(u => {
    return followerUsernames.has(u.username.toLowerCase()) || followerIds.has(u.pk);
  });

  console.log('\n=============================================');
  console.log(`📊 SUMMARY:`);
  console.log(`- Total Following: ${following.length}`);
  console.log(`- Total Followers: ${followers.length}`);
  console.log(`- Mutual Follows:  ${mutuals.length}`);
  console.log(`- NOT Following You Back: ${notFollowingBack.length}`);
  console.log(`- Fans (They follow, you don't): ${fans.length}`);
  console.log('=============================================\n');

  console.log(`🚨 PEOPLE YOU FOLLOW WHO DO NOT FOLLOW YOU BACK (${notFollowingBack.length}):`);
  notFollowingBack.forEach((u, i) => {
    console.log(`${(i + 1).toString().padStart(3, ' ')}. @${u.username.padEnd(25, ' ')} (${u.full_name || 'No Name'})${u.is_verified ? ' [Verified]' : ''}${u.is_private ? ' [Private]' : ''}`);
  });

  // Save report to artifacts
  const artifactsDir = path.resolve('artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const reportPath = path.join(artifactsDir, 'instagram_not_following_back.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    accountUserId: userId,
    stats: {
      followingCount: following.length,
      followersCount: followers.length,
      mutualCount: mutuals.length,
      notFollowingBackCount: notFollowingBack.length,
      fansCount: fans.length
    },
    notFollowingBack,
    fans,
    mutuals
  }, null, 2));

  console.log(`\n💾 Saved detailed report to: ${reportPath}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
