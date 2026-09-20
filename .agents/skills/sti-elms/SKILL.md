---
name: sti-elms
description: Autonomous assistant for STI ELMS (eLearning Management System). Enables fast batch downloading of course handouts, syllabi extraction, class listings, and lesson navigation in the dedicated background Agent Window with near-zero token overhead.
---

# STI ELMS Skill Guide

This skill provides ultra-fast, zero-token browser automation workflows for **STI ELMS** (`https://elms.sti.edu`).

## ⚡ Zero-Token Execution Instructions

Whenever the user asks to:
- Download handouts for a subject or all subjects
- List enrolled classes / subjects
- Extract syllabus or course documents

**DO NOT use multi-turn tool loops** (`brave_observe` + `brave_act`). 
Instead, run the dedicated CLI script directly via `run_command`:

### 1. List Enrolled Subjects
```bash
node .agents/skills/sti-elms/scripts/elms-cli.js --list
```

### 2. Download Handouts for a Specific Subject
```bash
node .agents/skills/sti-elms/scripts/elms-cli.js --subject "<Subject Name>"
```
*Example*:
```bash
node .agents/skills/sti-elms/scripts/elms-cli.js --subject "Game Development"
```

### 3. Download Handouts for All Subjects
```bash
node .agents/skills/sti-elms/scripts/elms-cli.js --all
```

---

## 📚 Enrolled Subjects & Direct Class IDs Reference

| Subject Name | Class ID | Direct URL |
| :--- | :--- | :--- |
| **Computer Graphics Programming** | `5713354` | `https://elms.sti.edu/student_class/show/5713354` |
| **Euthenics 2** | `5713244` | `https://elms.sti.edu/student_class/show/5713244` |
| **Game Development** | `5712641` | `https://elms.sti.edu/student_class/show/5712641` |
| **Information Assurance and Security** | `5713238` | `https://elms.sti.edu/student_class/show/5713238` |
| **IT Capstone Project 2** | `5713247` | `https://elms.sti.edu/student_class/show/5713247` |
| **IT Service Management** | `5713245` | `https://elms.sti.edu/student_class/show/5713245` |
| **Network Technology 2** | `5713246` | `https://elms.sti.edu/student_class/show/5713246` |

---

## 🛡️ Co-Browsing Guarantees
- The script automatically binds to the **Agent Workspace Window** (`🤖 Agent Workspace`).
- The user's active personal browsing window and tabs are **never touched or focused**.
- Downloaded files are saved and organized into `artifacts/downloads/elms/handouts/<Subject Name>/`.
