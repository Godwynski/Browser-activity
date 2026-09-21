# Agent Instructions & Workspace Standards

## Critical Rules for all AI Coding Agents:
1. **Never dump files into the root workspace**:
   - Coursework must go to `courses/<Subject_Name>/assignments/<Term>/<Module_Name>/`.
   - Handouts go to `courses/<Subject_Name>/handouts/`.
   - Syllabi go to `courses/<Subject_Name>/syllabi/`.
2. **Standard Module Layout**:
   - `materials/`: original PDFs or prompt text
   - `src/`: executable code
   - `answer.md`: final deliverable
   - `.tmp/`: temporary scratch or extracted text (gitignored)
3. **Scripts Organization**:
   - Categorize under `brave-mcp/scripts/{cdp, elms, gdrive, social, scratch}`.
4. **Clean Git Status**:
   - Keep `__pycache__` and scratch text files out of git tracking.
