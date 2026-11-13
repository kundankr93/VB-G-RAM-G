VB-G-RAM-G UI CORRECTION PATCH

This patch fixes the Advanced Operations > Offline drafts form layout shown in the supplied screenshot.
It replaces frontend/src/AdvancedFeatures.jsx with a structured, accessible form and adds
frontend/src/advanced-operations-fix.css as an additive stylesheet.

IMPORTANT:
1. Stop the Vite frontend server.
2. Back up frontend/src/AdvancedFeatures.jsx and frontend/src/App.css.
3. Copy AdvancedFeatures.jsx from this patch over frontend/src/AdvancedFeatures.jsx.
4. Open frontend/src/main.jsx (or the file where App.css is imported) and add:
   import './advanced-operations-fix.css'
   immediately after the existing App.css import.
   This keeps the original stylesheet intact.
5. Start the frontend and test Operations hub > Advanced features > Offline drafts.

The form now uses a responsive grid, consistent input styling, clear spacing, accessible labels,
button loading states, and visible success/error feedback.

This is a focused UI correction. It does not claim to fix unreported backend/API failures.
The existing offline draft submission endpoint remains:
POST /api/enhancements/works/:workId/inspections
