/**
 * BaseAdapter: Universal abstract interface for website-specific automation adapters.
 * Enables zero-token deterministic scraping, task inspection, and asset syncing.
 */
export class BaseAdapter {
  constructor(name, domains = []) {
    this.name = name;
    this.domains = domains;
  }

  /**
   * Evaluates if this adapter can handle the given URL.
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    if (!url) return false;
    return this.domains.some(d => url.includes(d));
  }

  /**
   * Inspects the page and returns structured domain data (assignments, files, tasks).
   * @param {import('playwright-core').Page} page
   * @returns {Promise<object>}
   */
  async inspect(page) {
    throw new Error(`[${this.name}] inspect() not implemented.`);
  }

  /**
   * Extracts or syncs assets/materials from the page.
   * @param {import('playwright-core').Page} page
   * @param {object} options
   * @returns {Promise<object>}
   */
  async syncMaterials(page, options = {}) {
    throw new Error(`[${this.name}] syncMaterials() not implemented.`);
  }
}
