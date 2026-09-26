/**
 * Universal Browser Control Runtime — Text Extractor
 *
 * Extracts clean, visible text from a page or container element without
 * returning script, style, or raw DOM debris.
 *
 * Supports both plain text and hierarchical markdown formatting (headings,
 * lists, blockquotes).
 */

import { ValidationError } from '../core/errors.js';

/**
 * Extract visible text from a page.
 *
 * @param {import('playwright-core').Page} page
 * @param {object} [options]
 * @param {string} [options.scope]        - CSS selector to scope extraction (default: 'body')
 * @param {string} [options.format='plain'] - 'plain' | 'markdown'
 * @param {number} [options.maxChars]     - Truncate text to maxChars if set
 * @param {number} [options.maxLines]     - Truncate to maxLines if set
 * @returns {Promise<{ text: string, format: string, charCount: number, lineCount: number }>}
 */
export async function extractText(page, options = {}) {
  const scope = options.scope || 'body';
  const format = options.format === 'markdown' ? 'markdown' : 'plain';
  const maxChars = options.maxChars || 0;
  const maxLines = options.maxLines || 0;

  const result = await page.evaluate(
    ({ scope, format }) => {
      const root = document.querySelector(scope);
      if (!root) {
        return { error: `Scope element not found: "${scope}"` };
      }

      // Check if element is visible
      function isVisible(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }

      const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEMPLATE', 'HEAD']);

      if (format === 'plain') {
        // Collect visible text nodes
        const lines = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent || IGNORED_TAGS.has(parent.tagName) || !isVisible(parent)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!node.textContent.trim()) {
              return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let currentNode;
        while ((currentNode = walker.nextNode())) {
          const text = currentNode.textContent.replace(/\s+/g, ' ').trim();
          if (text) {
            lines.push(text);
          }
        }

        const fullText = lines.join('\n');
        return { text: fullText };
      } else {
        // Markdown format — preserve headings, paragraphs, lists, blockquotes
        const out = [];

        function traverse(node) {
          if (!node) return;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName;
            if (IGNORED_TAGS.has(tag) || !isVisible(node)) return;

            // Headings
            if (/^H[1-6]$/.test(tag)) {
              const level = parseInt(tag[1], 10);
              const hashes = '#'.repeat(level);
              const text = node.textContent.trim().replace(/\s+/g, ' ');
              if (text) out.push(`\n${hashes} ${text}\n`);
              return;
            }

            // Paragraph
            if (tag === 'P') {
              const text = node.textContent.trim().replace(/\s+/g, ' ');
              if (text) out.push(`\n${text}\n`);
              return;
            }

            // Blockquote
            if (tag === 'BLOCKQUOTE') {
              const text = node.textContent.trim().replace(/\s+/g, ' ');
              if (text) out.push(`\n> ${text}\n`);
              return;
            }

            // List item
            if (tag === 'LI') {
              const text = node.textContent.trim().replace(/\s+/g, ' ');
              if (text) out.push(`- ${text}`);
              return;
            }

            // Pre / Code
            if (tag === 'PRE') {
              out.push(`\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n`);
              return;
            }

            // Recursively traverse children
            for (let child = node.firstChild; child; child = child.nextSibling) {
              traverse(child);
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim().replace(/\s+/g, ' ');
            if (text && (!node.parentElement || node.parentElement === root)) {
              out.push(text);
            }
          }
        }

        traverse(root);

        // Normalize multiple blank lines
        const raw = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        return { text: raw };
      }
    },
    { scope, format }
  );

  if (result.error) {
    throw new ValidationError(result.error, { scope });
  }

  let text = result.text || '';

  // Apply truncation limits if configured
  if (maxLines > 0) {
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      text = lines.slice(0, maxLines).join('\n') + `\n... [truncated at ${maxLines} lines]`;
    }
  }

  if (maxChars > 0 && text.length > maxChars) {
    text = text.slice(0, maxChars) + `... [truncated at ${maxChars} chars]`;
  }

  const lines = text ? text.split('\n') : [];
  return {
    text,
    format,
    charCount: text.length,
    lineCount: lines.length
  };
}
