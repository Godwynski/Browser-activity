# Agent Instructions & Workspace Standards

## Critical Rules for all AI Coding Agents:
1. **Never open another browser instance or separate profile window**:
   - The user's Brave browser is already running and connected.
   - Never launch `AgentProfile` or spawn secondary browser instances. Always attach to the existing connected session.
2. **Never dump files into the root workspace**:
   - Coursework must go to `courses/<Subject_Name>/assignments/<Term>/<Module_Name>/`.
   - Handouts go to `courses/<Subject_Name>/handouts/`.
   - Syllabi go to `courses/<Subject_Name>/syllabi/`.
3. **Standard Module Layout**:
   - `materials/`: original PDFs or prompt text
   - `src/`: executable code
   - `answer.md`: final deliverable
   - `.tmp/`: temporary scratch or extracted text (gitignored)
4. **Scripts Organization**:
   - Categorize under `brave-mcp/scripts/{cdp, elms, gdrive, social, scratch}`.
5. **Clean Git Status**:
   - Keep `__pycache__` and scratch text files out of git tracking.

