/**
 * Universal Browser Control Runtime — Table Extractor
 *
 * Extracts tabular data from standard HTML <table> elements as well as ARIA
 * [role="table"] and [role="grid"] structures.
 *
 * Produces structured JSON (keyed rows & 2D matrix) and clean Markdown tables.
 */

import { ValidationError } from '../core/errors.js';

/**
 * Format headers and matrix into a GitHub-flavored Markdown table string.
 *
 * @param {string[]} headers
 * @param {string[][]} matrix
 * @returns {string}
 */
export function formatMarkdownTable(headers, matrix) {
  if (!headers.length && !matrix.length) return '';

  const colCount = Math.max(headers.length, ...matrix.map(r => r.length));
  if (colCount === 0) return '';

  const safeHeaders = Array.from({ length: colCount }, (_, i) => headers[i] || `Col ${i + 1}`);

  const lines = [];
  // Header row
  lines.push(`| ${safeHeaders.map(h => h.replace(/\|/g, '\\|')).join(' | ')} |`);
  // Separator row
  lines.push(`| ${safeHeaders.map(() => '---').join(' | ')} |`);

  // Data rows
  for (const row of matrix) {
    const cells = Array.from({ length: colCount }, (_, i) => (row[i] !== undefined ? String(row[i]).replace(/\|/g, '\\|') : ''));
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Extract table data from a page.
 *
 * @param {import('playwright-core').Page} page
 * @param {object} [options]
 * @param {string}  [options.scope]         - CSS selector to scope table search
 * @param {string}  [options.selector]      - Specific table selector (e.g. '#pricing-table')
 * @param {number}  [options.tableIndex=0]  - 0-based index of table to extract
 * @param {boolean} [options.all=false]     - If true, extract all tables in scope
 * @param {string}  [options.format='both'] - 'json' | 'markdown' | 'both'
 * @returns {Promise<{ tables: TableData[], count: number }>}
 *
 * @typedef {object} TableData
 * @property {number}                 index    - Table index on page
 * @property {string}                 selector - Resolved selector or tag description
 * @property {string[]}               headers  - Header column names
 * @property {Array<Record<string, string>>} rows - Array of objects keyed by header name
 * @property {string[][]}             matrix   - Raw 2D array of cell string values
 * @property {string}                 [markdown] - Formatted markdown table string
 * @property {number}                 rowCount - Number of data rows
 * @property {number}                 colCount - Number of columns
 */
export async function extractTables(page, options = {}) {
  const scope = options.scope || 'body';
  const selector = options.selector || null;
  const tableIndex = typeof options.tableIndex === 'number' ? options.tableIndex : 0;
  const all = options.all === true;
  const format = options.format || 'both';

  const result = await page.evaluate(
    ({ scope, selector, tableIndex, all }) => {
      const root = document.querySelector(scope);
      if (!root) {
        return { error: `Scope element not found: "${scope}"` };
      }

      // Collect table elements (native <table> or ARIA [role="table"], [role="grid"])
      let tableEls = [];
      if (selector) {
        const found = root.querySelector(selector);
        if (found) tableEls = [found];
      } else {
        tableEls = Array.from(root.querySelectorAll('table, [role="table"], [role="grid"]'));
      }

      if (tableEls.length === 0) {
        return { tables: [] };
      }

      const targetTables = all ? tableEls : [tableEls[tableIndex] || null].filter(Boolean);

      function cleanCellText(cell) {
        return (cell ? cell.textContent : '').replace(/\s+/g, ' ').trim();
      }

      const extracted = targetTables.map((tbl, idx) => {
        const isNative = tbl.tagName.toLowerCase() === 'table';
        let headers = [];
        const matrix = [];

        if (isNative) {
          // Native HTML Table
          // Check for thead th elements
          const theadHeaders = Array.from(tbl.querySelectorAll('thead tr th, thead tr td'));
          if (theadHeaders.length > 0) {
            headers = theadHeaders.map(cleanCellText);
          } else {
            // First tr in tbody or table with th elements
            const firstRowHeaders = Array.from(tbl.querySelectorAll('tr:first-child th'));
            if (firstRowHeaders.length > 0) {
              headers = firstRowHeaders.map(cleanCellText);
            }
          }

          // Extract data rows
          const rows = Array.from(tbl.querySelectorAll('tbody tr, tr'));
          for (const row of rows) {
            // Skip the row if it's identical to header row
            const thCount = row.querySelectorAll('th').length;
            const tdElements = Array.from(row.querySelectorAll('td'));

            if (tdElements.length === 0 && thCount > 0 && headers.length > 0) {
              // pure header row already captured
              continue;
            }

            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length > 0) {
              matrix.push(cells.map(cleanCellText));
            }
          }

          // If no explicit headers were found, treat first matrix row as header if available
          if (headers.length === 0 && matrix.length > 0) {
            headers = matrix.shift();
          }
        } else {
          // ARIA table / grid
          const headerRows = Array.from(tbl.querySelectorAll('[role="row"]:has([role="columnheader"])'));
          if (headerRows.length > 0) {
            headers = Array.from(headerRows[0].querySelectorAll('[role="columnheader"]')).map(cleanCellText);
          }

          const dataRows = Array.from(tbl.querySelectorAll('[role="row"]:not(:has([role="columnheader"]))'));
          for (const row of dataRows) {
            const cells = Array.from(row.querySelectorAll('[role="cell"], [role="gridcell"]'));
            if (cells.length > 0) {
              matrix.push(cells.map(cleanCellText));
            }
          }
        }

        // Build keyed rows
        const colCount = Math.max(headers.length, ...matrix.map(r => r.length), 0);
        const resolvedHeaders = Array.from({ length: colCount }, (_, i) => headers[i] || `col_${i + 1}`);

        const keyedRows = matrix.map(row => {
          const rowObj = {};
          resolvedHeaders.forEach((header, i) => {
            rowObj[header] = row[i] !== undefined ? row[i] : '';
          });
          return rowObj;
        });

        return {
          index: all ? idx : tableIndex,
          selector: tbl.id ? `#${tbl.id}` : `${tbl.tagName.toLowerCase()}${tbl.className ? '.' + tbl.className.split(' ').join('.') : ''}`,
          headers: resolvedHeaders,
          rows: keyedRows,
          matrix,
          rowCount: keyedRows.length,
          colCount
        };
      });

      return { tables: extracted };
    },
    { scope, selector, tableIndex, all }
  );

  if (result.error) {
    throw new ValidationError(result.error, { scope, selector });
  }

  const tables = (result.tables || []).map(tbl => {
    const formatted = { ...tbl };
    if (format === 'markdown' || format === 'both') {
      formatted.markdown = formatMarkdownTable(tbl.headers, tbl.matrix);
    }
    if (format === 'markdown') {
      delete formatted.matrix;
    }
    return formatted;
  });

  return {
    tables,
    count: tables.length
  };
}
