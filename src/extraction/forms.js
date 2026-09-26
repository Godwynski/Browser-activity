/**
 * Universal Browser Control Runtime — Form Extractor
 *
 * Extracts form structure, inputs, controls, associated labels, current values,
 * and validation state from forms or standalone field groups.
 */

import { ValidationError } from '../core/errors.js';

/**
 * Extract form fields and structures from a page.
 *
 * @param {import('playwright-core').Page} page
 * @param {object} [options]
 * @param {string}  [options.scope]        - CSS selector to scope search
 * @param {number}  [options.formIndex]    - Specific form index (default: all)
 * @param {boolean} [options.includeOrphanFields=true] - Include inputs not inside a <form>
 * @returns {Promise<{ forms: FormSummary[], orphanFields: FormField[], count: number }>}
 *
 * @typedef {object} FormSummary
 * @property {number}       index   - Form index
 * @property {string}       id      - Form id attribute
 * @property {string}       name    - Form name attribute
 * @property {string}       action  - Form action URL
 * @property {string}       method  - Form method ('get' | 'post')
 * @property {FormField[]}  fields  - Input fields in this form
 * @property {string[]}     buttons - Labels of submit / action buttons in form
 *
 * @typedef {object} FormField
 * @property {string}   name        - Input name
 * @property {string}   id          - Input id
 * @property {string}   type        - input type, 'select', or 'textarea'
 * @property {string}   label       - Associated label text
 * @property {*}        value       - Current value or checked status
 * @property {string}   placeholder - Placeholder text
 * @property {boolean}  required    - Whether field is required
 * @property {boolean}  disabled    - Whether field is disabled
 * @property {boolean}  readonly    - Whether field is readonly
 * @property {Array<{ value: string, text: string, selected: boolean }>} [options] - For select elements
 */
export async function extractForms(page, options = {}) {
  const scope = options.scope || 'body';
  const formIndex = typeof options.formIndex === 'number' ? options.formIndex : null;
  const includeOrphanFields = options.includeOrphanFields !== false;

  const result = await page.evaluate(
    ({ scope, formIndex, includeOrphanFields }) => {
      const root = document.querySelector(scope);
      if (!root) {
        return { error: `Scope element not found: "${scope}"` };
      }

      function getFieldLabel(el) {
        // 1. aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();

        // 2. aria-labelledby
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          if (labelEl) return labelEl.textContent.trim();
        }

        // 3. <label for="id">
        if (el.id) {
          const forLabel = document.querySelector(`label[for="${el.id}"]`);
          if (forLabel) return forLabel.textContent.trim();
        }

        // 4. Closest enclosing <label>
        const enclosingLabel = el.closest('label');
        if (enclosingLabel) {
          // Clone and remove inputs to get just label text
          const clone = enclosingLabel.cloneNode(true);
          const innerInputs = clone.querySelectorAll('input, select, textarea');
          innerInputs.forEach(i => i.remove());
          const text = clone.textContent.trim();
          if (text) return text;
        }

        // 5. Placeholder as fallback
        return el.getAttribute('placeholder') || '';
      }

      function extractField(el) {
        const tag = el.tagName.toLowerCase();
        const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
        const name = el.getAttribute('name') || '';
        const id = el.id || '';
        const label = getFieldLabel(el);
        const placeholder = el.getAttribute('placeholder') || '';
        const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
        const readonly = el.hasAttribute('readonly');

        let value;
        let selectOptions;

        if (type === 'checkbox' || type === 'radio') {
          value = el.checked;
        } else if (tag === 'select') {
          selectOptions = Array.from(el.options).map(opt => ({
            value: opt.value,
            text: opt.textContent.trim(),
            selected: opt.selected
          }));
          value = el.value;
        } else {
          value = el.value !== undefined ? el.value : '';
        }

        return {
          name,
          id,
          type,
          label,
          value,
          placeholder,
          required,
          disabled,
          readonly,
          options: selectOptions
        };
      }

      let formElements = [];
      if (root.tagName.toLowerCase() === 'form') {
        formElements = [root];
      } else {
        formElements = Array.from(root.querySelectorAll('form'));
      }
      const targetForms = formIndex !== null
        ? (formElements[formIndex] ? [formElements[formIndex]] : [])
        : formElements;

      const processedInputs = new Set();

      const forms = targetForms.map((form, idx) => {
        const fields = [];
        const buttons = [];

        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
        for (const input of inputs) {
          processedInputs.add(input);
          const type = (input.getAttribute('type') || '').toLowerCase();
          if (type === 'submit' || type === 'button' || type === 'reset') {
            buttons.push(input.value || input.getAttribute('aria-label') || type);
          } else {
            fields.push(extractField(input));
          }
        }

        const buttonEls = Array.from(form.querySelectorAll('button'));
        for (const btn of buttonEls) {
          buttons.push(btn.textContent.trim() || btn.getAttribute('aria-label') || 'Submit');
        }

        return {
          index: formIndex !== null ? formIndex : idx,
          id: form.id || '',
          name: form.getAttribute('name') || '',
          action: form.getAttribute('action') || '',
          method: (form.getAttribute('method') || 'GET').toUpperCase(),
          fields,
          buttons
        };
      });

      // Orphan fields (outside of any <form>)
      const orphanFields = [];
      if (includeOrphanFields && formIndex === null) {
        const allInputs = Array.from(root.querySelectorAll('input, select, textarea'));
        for (const input of allInputs) {
          if (!processedInputs.has(input) && !input.closest('form')) {
            const type = (input.getAttribute('type') || '').toLowerCase();
            if (type !== 'submit' && type !== 'button' && type !== 'reset') {
              orphanFields.push(extractField(input));
            }
          }
        }
      }

      return {
        forms,
        orphanFields,
        count: forms.length
      };
    },
    { scope, formIndex, includeOrphanFields }
  );

  if (result.error) {
    throw new ValidationError(result.error, { scope });
  }

  return result;
}
