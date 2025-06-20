# Quick Start Refactoring Prompt for Claude

Copy and paste this prompt to Claude with filesystem access:

---

I need help refactoring the AI Dock application codebase into smaller, more atomic files. You have access to the filesystem and should follow the detailed refactoring guidelines at `/Users/blas/Desktop/INRE/INRE-DOCK-2/Helpers/refactoring/refactor_prompt.md`.

**Your Task:**
1. First, analyze the current file structure in both Frontend (`/Users/blas/Desktop/INRE/INRE-DOCK-2/Front/`) and Backend (`/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/`) directories
2. Identify all files larger than 200 lines
3. Create a prioritized refactoring plan
4. Start refactoring the highest priority files one by one
5. For each file:
   - Analyze its current responsibilities
   - Split into smaller, single-responsibility files
   - Update all imports and dependencies
   - Test that functionality is preserved
   - Document what was changed and why

**Important Rules:**
- NEVER delete original files until refactoring is confirmed working
- Maintain ALL existing functionality
- Test after each file split
- Keep educational comments from original code
- Follow the naming conventions and structure patterns in the guidelines

**Start with:** "Please analyze the current file structure and show me which files need refactoring."

The detailed methodology is in `/Users/blas/Desktop/INRE/INRE-DOCK-2/Helpers/refactoring/refactor_prompt.md`. Reference it for specific patterns and best practices.
