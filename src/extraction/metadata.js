/**
 * Universal Browser Control Runtime — Metadata / Structured Page Extractor
 *
 * Extracts document-level metadata, OpenGraph tags, JSON-LD structured data,
 * and heading hierarchy for page classification and understanding.
 */

/**
 * Extract structured metadata from a page.
 *
 * @param {import('playwright-core').Page} page
 * @returns {Promise<PageMetadata>}
 *
 * @typedef {object} PageMetadata
 * @property {string}   title          - Page title (<title> or og:title)
 * @property {string}   url            - Page URL
 * @property {string}   description    - Meta description or og:description
 * @property {string}   canonical      - Canonical link URL
 * @property {string}   language       - HTML lang attribute
 * @property {Record<string, string>} openGraph - OpenGraph properties (og:*)
 * @property {Array<{ level: number, text: string }>} headings - Heading hierarchy
 * @property {Array<object>} jsonLd    - Parsed JSON-LD structured data objects
 */
export async function extractMetadata(page) {
  return await page.evaluate(() => {
    const title = document.title || '';
    const url = window.location.href;
    const language = document.documentElement.lang || '';

    // Description
    const metaDesc = document.querySelector('meta[name="description"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const description = (metaDesc && metaDesc.content) || (ogDesc && ogDesc.content) || '';

    // Canonical
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const canonical = canonicalLink ? canonicalLink.href : url;

    // OpenGraph
    const openGraph = {};
    const ogMetaTags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
    for (const tag of ogMetaTags) {
      const prop = tag.getAttribute('property');
      const val = tag.getAttribute('content');
      if (prop && val) {
        openGraph[prop] = val;
      }
    }

    // Headings hierarchy
    const headings = [];
    const headingEls = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    for (const h of headingEls) {
      const level = parseInt(h.tagName[1], 10);
      const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        headings.push({ level, text });
      }
    }

    // JSON-LD structured data
    const jsonLd = [];
    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of jsonLdScripts) {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        jsonLd.push(parsed);
      } catch {
        // Ignore unparseable JSON-LD blocks
      }
    }

    return {
      title,
      url,
      description,
      canonical,
      language,
      openGraph,
      headings,
      jsonLd
    };
  });
}
