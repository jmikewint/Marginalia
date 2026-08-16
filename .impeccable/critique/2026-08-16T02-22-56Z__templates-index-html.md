---
target: templates/index.html (Syllabus Translator main UI)
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-16T02-22-56Z
slug: templates-index-html
---
Method: dual-agent (A: a9d5ec562d2ec4860 · B: aea6fb0bc89043490)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Spinner on Analyze, but Save/Delete give zero feedback |
| 2 | Match System / Real World | 3 | Plain-language section names; severity shown as raw lowercase word |
| 3 | User Control and Freedom | 1 | No undo on delete, no cancel on in-flight analyze |
| 4 | Consistency and Standards | 2 | Native `prompt()` for save breaks the themed, styled UI |
| 5 | Error Prevention | 2 | Password rule surfaces only after failed submit; file-vs-paste precedence is silent |
| 6 | Recognition Rather Than Recall | 1 | Sidebar shows bare course names only, no active-item indicator |
| 7 | Flexibility and Efficiency | 1 | No shortcuts, no drag-drop, no rename/search/multi-select |
| 8 | Aesthetic and Minimalist Design | 3 | Clean spacing and restrained palette, but no accent identity |
| 9 | Error Recovery | 1 | Errors render in the same gray card as results, no retry |
| 10 | Help and Documentation | 0 | No onboarding, no severity legend, no data-handling note |
| **Total** | | **16/40** | **Poor — major UX overhaul needed; core moments (save, delete, error) are broken or unstyled** |

## Design Specificity Verdict

**LLM assessment**: This reads as a generic form-plus-results CRUD shell wearing a syllabus-shaped skin. All three result sections (flags, grading, deadlines) share one identical `.section` card with no differentiated treatment for the thing that matters most emotionally — a "high severity" flag about a grade-tanking policy gets the same box, shadow, and heading style as a grading-weight table. Nothing in the visual language says "built to calm an anxious student down" beyond a red/orange left border. The information architecture (flags → grading → deadlines) is a sound triage order, and the `.ics` export is a genuinely purpose-built feature — but visually, swap the copy and this could be an expense-report parser.

**Deterministic scan**: `detect.mjs --json templates/index.html` exited 2 with 2 findings, both rule `side-tab` (side-tab accent border) on lines 174–175 — the `border-left` on `.flag.high` / `.flag.medium`. The scanner ran in degraded/regex-fallback mode (missing `htmlparser2`/`css-select`/`css-tree`/`domutils`), so this is an undercount, not a clean bill of health.

**Likely false positive**: Both `side-tab` hits are flagging a conventional severity-callout pattern (GitHub/Bootstrap-alert style) doing real semantic work — color-coding high vs. medium risk — not a decorative stray edge. Defensible as-is.

**Visual overlays**: Browser automation was declined for this session, so no in-page overlay or live screenshots were captured. Assessment B instead traced concrete, code-verifiable visual bugs directly from `templates/index.html` and `static/script.js` (below) rather than opinion.

**Code-verified bugs the detector's regex pass couldn't catch, but source-reading did**:
- `.flag.high` / `.flag.medium` (lines 174–175) hardcode light-mode-only colors (`#fef2f2`/`#fffbeb` bg, `#1a1a1a` text) with **no `[data-theme="dark"]` override**, while every other surface in the app correctly swaps via CSS custom properties. In dark mode, these two callouts — the single highest-stakes content in the product — will render as a light pink/amber card floating inside an otherwise near-black UI.
- `button:disabled { background:#999 }` (line 149) sits after the dark-theme button rule at equal specificity, so it wins the background in both themes while `color` still resolves per-theme. Net effect: in **light mode**, the disabled "Analyzing…" button shows white text on `#999` gray — roughly 2.8:1 contrast, below WCAG AA's 4.5:1 for normal text.
- `#auth-box` is a fixed `width: 320px` with no `max-width: 100%`. On a 320px-wide viewport (iPhone SE-class), the box exactly fills the screen with zero margin; anything narrower overflows.
- Only `body` has a `transition`; toggling dark mode fades the page background/text smoothly but every card, input, and border snaps instantly — an inconsistent, half-animated theme switch.

## Overall Impression

The bones are reasonable — sound information order, a working theme-token system, a genuinely useful `.ics` export — but the product breaks at exactly the moments a stressed student needs it to hold together: saving drops into an unstyled native `prompt()`, deleting a semester of extracted deadlines takes one unconfirmed tap on a 12px target, errors are visually indistinguishable from success, and the one visual language meant to signal risk (red/amber flags) silently stops working in dark mode. The single biggest opportunity is treating the flags → grading → deadlines results as three deliberately different emotional registers instead of one repeated card, and giving Save/Delete the weight their consequences deserve.

## What's Working

1. **Severity color-coding on flags** (`.flag.high` red / `.flag.medium` orange) is an efficient, real-world-matched visual language — a student can triage by color before reading text (when it renders correctly — see dark-mode bug above).
2. **Flags → grading → deadlines ordering** mirrors a sensible student triage mental model: risk first, stakes second, calendar third.
3. **The CSS custom-property theming system** (`--bg`, `--card-bg`, `--text`, `--text-muted`, `--border`, `--input-border`) is cleanly structured and consistently applied everywhere except the two flag classes and the disabled-button edge case — a solid foundation to fix forward from rather than rebuild.

## Priority Issues

**[P0] `save-btn` uses a native `prompt()` dialog** (`static/script.js:184`)
Why it matters: Breaks the themed UI completely (unstyleable, ignores dark mode), forces the user to recall/retype a course name Claude's response already had the text to infer, and gives zero success confirmation afterward — the one moment that should feel like relief ("your dates are safe now") currently looks broken.
Fix: Inline styled modal, pre-filled with a Claude-suggested course name, closing with a visible "Saved ✓" confirmation.
Suggested command: `$impeccable clarify`

**[P0] Deleting a saved syllabus is instant and irreversible** (`static/script.js:122-129`, `.delete-x`)
Why it matters: No confirmation, no undo, and the hit target is a 12px "✕" sitting directly beside the clickable course name — one mistap permanently destroys a semester's worth of extracted deadlines. Worse on mobile, where the same tap-adjacent problem meets thumb-sized targets.
Fix: Confirm dialog or a timed undo toast; enlarge the touch target and separate it further from the open action.
Suggested command: `$impeccable harden`

**[P1] Screen-reader/keyboard users are hard-blocked from core actions** (`templates/index.html:221`, `static/script.js:112-129`)
Why it matters: `#auth-toggle` is a `<div>` with only a click listener — no `tabindex`, no `role="button"`, no keydown handler — so a keyboard/SR user landing on Log In cannot reach Sign Up at all. `.saved-name` and `.delete-x` are plain `<span>`s with the same problem: saved syllabi can't be opened or managed without a mouse.
Fix: Make these real `<button>` elements (or add `role="button"` + `tabindex="0"` + Enter/Space handling); tie the file-upload `<label>` to `#syllabus-file` with a `for` attribute.
Suggested command: `$impeccable audit`

**[P1] Theming/contrast bugs at the two highest-stakes surfaces**
Why it matters: `.flag.high`/`.flag.medium` (lines 174-175) never got a `[data-theme="dark"]` override, so the syllabus's risk warnings — the single most important content in the product — render as a light pink/amber card stranded inside an otherwise dark UI. Separately, the disabled "Analyzing…" button in light mode shows white text on `#999` gray at roughly 2.8:1 contrast, below WCAG AA.
Fix: Add dark-theme token overrides for `.flag.high`/`.flag.medium`; resolve the `button:disabled` vs. `[data-theme="dark"] button` specificity collision explicitly.
Suggested command: `$impeccable colorize`

**[P1] Error states are visually identical to success content** (`static/script.js:251`, `:259`)
Why it matters: `Error: ${data.error}` renders in the exact same gray `.section` card as flags/grading/deadlines — no color, icon, or retry affordance. At the exact moment a stressed student most needs clarity after a failed analyze, the UI gives none.
Fix: Distinct `.error` treatment (color + icon) with an inline "Try again" button that doesn't require re-pasting.
Suggested command: `$impeccable clarify`

## Persona Red Flags

**Jordan (First-Timer)**: Lands on the login screen with zero explanation of what the product does — the subtitle ("Paste your syllabus below and get the important stuff, plainly") only appears *after* signing up, backwards for building trust before asking for a password. No legend explains "high" vs. "medium" severity the first time a flag appears. A failed analyze produces "Could not parse response" with no next step. Will abandon at the first error.

**Sam (Accessibility-Dependent)**: Completely blocked from Sign Up via keyboard/screen reader if landing on Log In (`#auth-toggle` is an unfocusable `<div>`). Cannot reopen or delete saved syllabi without a mouse (`.saved-name`/`.delete-x` are plain `<span>`s). The file-upload label isn't wired to its input via `for`, so a screen reader won't announce it correctly. The disabled-button contrast failure in light mode compounds this for low-vision users specifically.

**Casey (Distracted Mobile User)**: At the 700px breakpoint, the sidebar (saved list + dashboard button) renders full-width *above* the actual paste/upload form — Casey scrolls past their entire course list every visit before reaching the primary task, on the platform most students actually use. The tiny delete "✕" becomes a higher accidental-tap risk on touch. The `prompt()` save dialog surfaces as a native OS popup on mobile, which reads as a spam/permission prompt in context. At 320px width, `#auth-box`'s fixed width leaves zero margin.

## Minor Observations

- File upload and pasted text can both be populated with no visible precedence rule (`app.py:91-99` silently favors the file) — a student who fills both gets analyzed on a source they didn't intend, with no indication which one was used.
- Sidebar saved-item list carries zero metadata beyond course name (no date, no deadline count, no active-item highlight) — becomes hard to navigate once a student has several courses saved.
- Riley (stress-tester) note: `_parse_date_guess` (`app.py:217-242`) only matches a handful of "Month Day[, Year]" formats; unparseable dates are silently dropped from `.ics` export with zero user-facing indication, so a calendar export can be missing deadlines with no warning. Refreshing mid-analyze also silently abandons the in-flight (API-cost-incurring) request.
- No favicon, no password show/hide toggle.
- Save and Export buttons share identical styling with no primary/secondary visual priority, despite very different consequences.
- Dashboard view has no distinct URL/state (in-place `#results` swap), so back/refresh silently returns to the blank form.
- Only `body` has a CSS `transition`; dark-mode toggle fades the page shell but every card/input snaps instantly.

## Questions to Consider

- What if severity flags were reframed as an action checklist ("add these 3 dates now," "email your professor if you're near this threshold") instead of a red box restating the syllabus sentence back at the student?
- What if "Save" didn't exist as a separate step — every analyzed syllabus auto-saved under an inferred course name, editable later inline — removing both the `prompt()` dialog and the one moment that currently looks broken?
- Does this need to feel this generic? The IA is sound; nothing in the visual treatment currently says "syllabus" instead of "any form-and-results tool."
