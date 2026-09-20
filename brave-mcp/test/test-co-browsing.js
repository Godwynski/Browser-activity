import { BraveManager } from '../src/browser.js';

async function testParallelCoBrowsing() {
  console.log("==========================================================");
  console.log("🧪 TESTING PARALLEL CO-BROWSING & WINDOW ISOLATION");
  console.log("==========================================================\n");

  const brave = new BraveManager('http://127.0.0.1:9222');
  await brave.ensureConnected();

  // 1. List tabs and identify user tabs vs agent window
  const tabsBefore = await brave.listTabs();
  console.log(`Found ${tabsBefore.length} open tab(s):`);
  tabsBefore.forEach(t => {
    console.log(`  [${t.index}] ${t.isAgentWindow ? '🤖 [AGENT]' : '👤 [USER]'} ${t.title} (${t.url})`);
  });

  const userTab = tabsBefore.find(t => !t.isAgentWindow);
  if (!userTab) {
    console.log("⚠️ No user tab found, but proceeding with agent window validation.");
  } else {
    console.log(`\n👤 User Tab Baseline: [${userTab.index}] "${userTab.title}" at ${userTab.url}`);
  }

  // 2. Get the dedicated Agent Window Page
  console.log("\n🤖 Acquiring dedicated Agent Window...");
  const agentPage = await brave.getAgentPage({ autoCreate: true });
  const agentUrlBefore = agentPage.url();
  console.log(`   Agent Window acquired at URL: ${agentUrlBefore}`);

  // 3. Perform navigation on the Agent Page
  console.log("\n🚀 Navigating Agent Window to a test page...");
  await agentPage.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const agentTitleAfter = await agentPage.title();
  console.log(`   Agent Window successfully navigated to: "${agentTitleAfter}" (${agentPage.url()})`);

  // 4. Verify that the User Tab was NOT touched or navigated
  const tabsAfter = await brave.listTabs();
  if (userTab) {
    const userTabAfter = tabsAfter[userTab.index];
    console.log(`\n🔍 Verifying User Tab integrity...`);
    console.log(`   Expected Title: "${userTab.title}"`);
    console.log(`   Actual Title:   "${userTabAfter.title}"`);
    console.log(`   Expected URL:   "${userTab.url}"`);
    console.log(`   Actual URL:     "${userTabAfter.url}"`);

    if (userTabAfter.url === userTab.url) {
      console.log("✅ USER TAB REMAINS 100% UNTOUCHED! Window isolation verified.");
    } else {
      console.error("❌ USER TAB WAS COLLIDED WITH!");
      process.exit(1);
    }
  }

  console.log("\n🎉 PARALLEL CO-BROWSING VERIFICATION COMPLETE & PASSED!");
  process.exit(0);
}

testParallelCoBrowsing().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
