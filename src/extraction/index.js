/**
 * Universal Browser Control Runtime — Extraction Engine
 *
 * Provides targeted, structured extraction of visible text, tables, hyperlinks,
 * form schemas, and page metadata without requiring expensive full-DOM observations.
 */

import { ValidationError } from '../core/errors.js';
import { extractText } from './text.js';
import { extractTables } from './tables.js';
import { extractLinks } from './links.js';
import { extractForms } from './forms.js';
import { extractMetadata } from './metadata.js';

export { extractText } from './text.js';
export { extractTables, formatMarkdownTable } from './tables.js';
export { extractLinks } from './links.js';
export { extractForms } from './forms.js';
export { extractMetadata } from './metadata.js';

export class DataExtractor {
  /**
   * Extract targeted data from a page.
   *
   * @param {import('playwright-core').Page} page
   * @param {string} type - 'text' | 'table' | 'tables' | 'links' | 'forms' | 'form' | 'structured' | 'metadata'
   * @param {object} [options]
   * @returns {Promise<ExtractionResponse>}
   *
   * @typedef {object} ExtractionResponse
   * @property {string} type      - The extraction type
   * @property {*}      data      - The extracted payload
   * @property {number} itemCount - Number of extracted items
   * @property {number} timingMs  - Execution duration in milliseconds
   */
  async extract(page, type, options = {}) {
    if (!page) {
      throw new ValidationError('A valid page instance is required for extraction', { type });
    }

    const normalizedType = (type || '').toLowerCase().trim();
    const startTime = Date.now();
    let data;
    let itemCount = 0;

    switch (normalizedType) {
      case 'text': {
        const res = await extractText(page, options);
        data = res;
        itemCount = res.lineCount;
        break;
      }

      case 'table':
      case 'tables': {
        const res = await extractTables(page, options);
        data = res;
        itemCount = res.count;
        break;
      }

      case 'links':
      case 'link': {
        const res = await extractLinks(page, options);
        data = res;
        itemCount = res.links.length;
        break;
      }

      case 'form':
      case 'forms': {
        const res = await extractForms(page, options);
        data = res;
        itemCount = res.count + res.orphanFields.length;
        break;
      }

      case 'structured':
      case 'metadata': {
        const res = await extractMetadata(page);
        data = res;
        itemCount = res.headings.length;
        break;
      }

      default:
        throw new ValidationError(
          `Unsupported extraction type: "${type}". Supported types: 'text', 'table', 'links', 'form', 'structured'`,
          { type, supportedTypes: ['text', 'table', 'links', 'form', 'structured'] }
        );
    }

    const timingMs = Date.now() - startTime;
    return {
      type: normalizedType,
      data,
      itemCount,
      timingMs
    };
  }
}
