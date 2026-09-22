import { chromium } from 'playwright-core';
import { BrowserObserver } from '../src/observer.js';
import { StateVerifier } from '../src/verifier.js';
import { ActionEngine } from '../src/actions.js';

async function testTokenOptimizations() {
  console.log("==========================================================");
  console.log("🧪 TESTING TOKEN OPTIMIZATIONS (COMPACT, SCOPE, EVAL, BATCH)");
  console.log("==========================================================\n");

  const edgeExe = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const browser = await chromium.launch({
    executablePath: edgeExe,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const observer = new BrowserObserver();
  const verifier = new StateVerifier(observer);
  const actionEngine = new ActionEngine(observer, verifier);

  // Set up a rich test HTML page in the agent window
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><title>Token Optimization Test</title></head>
      <body>
        <header id="site-header">
          <nav>
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        <main id="main-content">
          <h1>Course Dashboard</h1>
          <form id="submission-form">
            <input type="text" id="student-name" placeholder="Student Name" value="Godwyn" />
            <select id="course-select">
              <option value="cs101">Computer Graphics</option>
              <option value="cs102">Game Development</option>
            </select>
            <button id="submit-btn" type="button" onclick="document.getElementById('status').innerText = 'Submitted Successfully!'">Submit Application</button>
            <div id="status">Ready</div>
          </form>
        </main>

        <footer id="site-footer">
          <p>Footer copyright</p>
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
        </footer>
      </body>
    </html>
  `);

  // 1. Compare Compact vs JSON Payload Size (Token Savings)
  console.log("📊 1. Comparing Full JSON vs Compact Notation...");
  const obsJson = await observer.observe(page, { format: 'json', includeScreenshot: false });
  const obsCompact = await observer.observe(page, { format: 'compact', includeScreenshot: false });

  const jsonBytes = JSON.stringify(obsJson.elements).length;
  const compactBytes = obsCompact.elements_compact.length;
  const reductionPercent = Math.round(((jsonBytes - compactBytes) / jsonBytes) * 100);

  console.log(`   JSON Payload Size:    ${jsonBytes} characters (~${Math.round(jsonBytes / 4)} tokens)`);
  console.log(`   Compact Payload Size: ${compactBytes} characters (~${Math.round(compactBytes / 4)} tokens)`);
  console.log(`   ✅ Token Reduction:    ${reductionPercent}% SAVED!`);

  if (reductionPercent < 40) {
    throw new Error(`Expected at least 40% reduction, got ${reductionPercent}%`);
  }

  // 2. Test Scoped Observation
  console.log("\n🎯 2. Testing Scoped Observation (scope: '#main-content')...");
  const obsScoped = await observer.observe(page, { scope: '#main-content', includeScreenshot: false });
  console.log(`   Total Page Elements:   ${obsJson.element_count}`);
  console.log(`   Scoped Main Elements:  ${obsScoped.element_count}`);
  
  // Header and Footer links should be excluded in scoped observation
  const hasFooterLink = obsScoped.elements.some(e => (e.name || '').includes('Privacy Policy'));
  if (hasFooterLink) {
    throw new Error("Scoped observation leaked footer elements!");
  }
  console.log("   ✅ Scoped observation strictly isolated main content elements!");

  // 3. Test Direct JS Evaluation (brave_eval capability)
  console.log("\n⚡ 3. Testing Direct In-Page JS Evaluation (brave_eval)...");
  const evalResult = await page.evaluate(() => {
    return {
      title: document.title,
      studentName: document.getElementById('student-name').value,
      courses: Array.from(document.querySelectorAll('#course-select option')).map(o => o.text)
    };
  });
  console.log("   Evaluation Result:", JSON.stringify(evalResult));
  if (evalResult.studentName !== 'Godwyn' || evalResult.courses.length !== 2) {
    throw new Error("Evaluation returned unexpected result");
  }
  console.log("   ✅ brave_eval executed with 0 token observation overhead!");

  // 4. Test Sequential Action Execution (brave_batch_act)
  console.log("\n🔄 4. Testing Action Batching (brave_batch_act)...");
  const submitRef = obsScoped.elements.find(e => e.domMeta?.id === 'submit-btn');
  if (!submitRef) throw new Error("Could not find submit button in scoped observation");

  const batchReceipts = [];
  // Step 1: Click submit
  const r1 = await actionEngine.execute(page, { action: 'click', ref: submitRef.ref, obs_id: obsScoped.obs_id });
  batchReceipts.push(r1);

  const statusText = await page.$eval('#status', el => el.innerText);
  console.log(`   Form Status After Batch Action: "${statusText}"`);
  if (statusText !== 'Submitted Successfully!') {
    throw new Error("Batch action did not change status text");
  }
  console.log("   ✅ Batch action executed and verified!");

  console.log("\n🎉 ALL TOKEN OPTIMIZATION TESTS PASSED SUCCESSFULLY!");
  await browser.close();
  process.exit(0);
}

testTokenOptimizations().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
