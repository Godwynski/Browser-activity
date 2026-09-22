import { runElmsCli } from '../../../.agents/skills/sti-elms/scripts/elms-cli.js';


/**
 * Fast ELMS Handout Downloader Entrypoint.
 * Delegates to the unified STI ELMS skill CLI.
 */
runElmsCli().catch(err => {
  console.error("❌ Error downloading handouts:", err);
  process.exit(1);
});
