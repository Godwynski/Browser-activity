/**
 * Universal Browser Control Runtime — Links Extractor
 *
 * Extracts all hyperlinks from a page or container, with classification into
 * internal / external, domain extraction, and anchor text.
 */

import { ValidationError } from '../core/errors.js';

/**
 * Extract links from a page.
 *
 * @param {import('playwright-core').Page} page
 * @param {object} [options]
 * @param {string} [options.scope]          - CSS selector to scope search
 * @param {string} [options.filter='all']   - 'all' | 'internal' | 'external'
 * @param {number} [options.limit=0]        - Max number of links to return (0 = unlimited)
 * @returns {Promise<{ links: LinkItem[], total: number, internalCount: number, externalCount: number }>}
 *
 * @typedef {object} LinkItem
 * @property {string}  text       - Visible link text
 * @property {string}  href       - Normalized absolute URL
 * @property {string}  rawHref    - Raw href attribute value
 * @property {string}  domain     - Hostname of target URL
 * @property {boolean} isInternal - Whether link targets the same origin as current page
 * @property {string}  target     - Target attribute (e.g. '_blank')
 * @property {string}  rel        - Rel attribute (e.g. 'noopener noreferrer')
 * @property {string}  title      - Title attribute
 */
export async function extractLinks(page, options = {}) {
  const scope = options.scope || 'body';
  const filter = options.filter || 'all';
  const limit = options.limit || 0;

  const result = await page.evaluate(
    ({ scope, filter, limit }) => {
      const root = document.querySelector(scope);
      if (!root) {
        return { error: `Scope element not found: "${scope}"` };
      }

      const pageOrigin = window.location.origin;
      const pageHost = window.location.hostname;

      const elements = Array.from(root.querySelectorAll('a[href], [role="link"][href]'));

      let internalCount = 0;
      let externalCount = 0;
      const allLinks = [];

      for (const el of elements) {
        const rawHref = el.getAttribute('href') || '';
        if (!rawHref || rawHref.startsWith('javascript:') || rawHref === '#') {
          continue;
        }

        let absoluteHref = '';
        let domain = '';
        let isInternal = false;

        try {
          const parsed = new URL(rawHref, window.location.href);
          absoluteHref = parsed.href;
          domain = parsed.hostname;
          isInternal = (parsed.origin === pageOrigin || parsed.hostname === pageHost);
        } catch {
          absoluteHref = rawHref;
          domain = '';
          isInternal = false;
        }

        if (isInternal) {
          internalCount++;
        } else {
          externalCount++;
        }

        if (filter === 'internal' && !isInternal) continue;
        if (filter === 'external' && isInternal) continue;

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const title = el.getAttribute('title') || '';
        const target = el.getAttribute('target') || '';
        const rel = el.getAttribute('rel') || '';

        allLinks.push({
          text,
          href: absoluteHref,
          rawHref,
          domain,
          isInternal,
          target,
          rel,
          title
        });
      }

      const total = allLinks.length;
      const links = limit > 0 ? allLinks.slice(0, limit) : allLinks;

      return {
        links,
        total,
        internalCount,
        externalCount
      };
    },
    { scope, filter, limit }
  );

  if (result.error) {
    throw new ValidationError(result.error, { scope });
  }

  return result;
}
