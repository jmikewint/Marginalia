---
target: the app (templates/index.html)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-17T04-04-09Z
slug: templates-index-html
---
Method: dual-agent (A: a329156b9e9281c30 · B: a0f69b28f20e89601)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Staged status text ("Reading file...", "Analyzing with Claude...") is good, but the results area goes blank with only a 14px button spinner during the app's single longest, highest-stakes wait |
| 2 | Match System / Real World | 3/4 | Strong domain language in the legend and section headers, but raw backend strings ("Could not parse response," "Not logged in") leak straight into user-facing error copy |
| 3 | User Control and Freedom | 3/4 | Undo-able delete, Escape/click-outside modal dismissal, Cancel buttons are solid — but once Analyze is clicked there's no way to cancel, only wait it out |
| 4 | Consistency and Standards | 3/4 | Button/label/icon system is uniform throughout; disabled-state pattern is applied consistently even where its visual effect (contrast) is weak |
| 5 | Error Prevention | 3/4 | File-vs-paste mutual exclusion and double-submit guards are genuinely good — but the 6-character password minimum is never surfaced until after a failed signup attempt |
| 6 | Recognition Rather Than Recall | 3/4 | Labels stay visible in context, but the sidebar severity dot's color code is explained once (in the flags legend) and never where the dots actually live |
| 7 | Flexibility and Efficiency | 1/4 | No search/filter/sort for saved syllabi, no bulk delete, no keyboard shortcuts beyond basic form Enter/Escape |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean spacing and restrained palette overall, undercut by rename/delete icons being permanently visible on every sidebar row instead of disclosed on hover/focus |
| 9 | Error Recovery | 2/4 | A retry button exists, but it's frequently responding to an unactionable technical error string rather than real guidance |
| 10 | Help and Documentation | 1/4 | No onboarding, no tooltips beyond the one severity legend, no stated file-size limit, no privacy statement about uploaded content |
| **Total** | | **25/40** | **Acceptable** |

Deterministic scan returned zero findings this run, but ran in a degraded fallback mode (see Deterministic scan below) — treat this table as resting on Assessment A's manual review alone, not detector-corroborated.

## Design Specificity Verdict

**LLM assessment**: Strip the copy strings and this is indistinguishable from any generic "upload a document, get an AI summary" SaaS shell. The indigo/ink palette, Cabinet Grotesk display type on uppercase-tracked eyebrow labels, dashed-border dropzone, and card-based results list are the current default vocabulary for Linear/Notion/Stripe-adjacent tools, not anything that specifically reads as "syllabus" or "academic." The domain specificity lives entirely in copy — "Watch out for," the severity legend, "Key deadlines" — which is well-written, but nothing visual (iconography, color use, layout metaphor) signals academic calendars, grading, or student life. Swap the copy for "Invoice Analyzer" or "Contract Reviewer" and the interface would need zero visual changes.

**Deterministic scan**: The CLI detector (`detect.mjs --json templates/index.html`) ran and exited 0, but printed: `impeccable detect: DEGRADED - HTML parser modules unavailable (htmlparser2, css-select, css-tree, domutils). Falling back to regex matching.` The JSON payload was `[]` (zero findings). Root cause: those four packages aren't installed anywhere reachable from this project (no project-root `node_modules`, no `package.json` under the skill directory). In this mode the detector cannot do selector matching, CSS custom-property resolution, or computed contrast checking — the categories most likely to catch real issues here. **The zero-findings result is not a clean bill of health; it's an inconclusive scan that should be re-run once the detector's parser dependencies are available.**

**Visual overlays**: Not available this session — no browser automation tool (Playwright/Puppeteer/browser-canvas) was exposed, so no live page could be opened, mutated, or screenshotted. Fallback signal: "no mutable browser tool available." No user-visible overlay exists; this critique rests on source reading, not rendered-page inspection.

## Overall Impression

The interface is competent and consistent — the interaction craft (undo-able delete, focus management, motion system, mutual-exclusion input guards) is genuinely above the bar for a tool this size. What's missing is a point of view: visually, this could be any B2B upload-and-results tool, and structurally, the account system creates a real adoption tax (no way to try the core feature without signing up first) and a real dead end (no password recovery at all). The single biggest opportunity is closing the gap between the craft already invested in interaction details and the complete absence of anything that visually signals "this is for a stressed student reading a scary syllabus."

## What's Working

1. **The severity legend copy** — placed inline above the flag list every time, it does real emotional-design work by translating "HIGH" from an alarm into a calibrated signal ("could seriously hurt your grade" vs. "worth knowing, but less urgent"), exactly where a student needs it most.
2. **Undo-able delete with a 5-second window** — paired with a toast whose Undo button receives focus automatically, this is real user-control-and-freedom craft that serves keyboard/screen-reader users, not just mouse users.
3. **File-vs-paste mutual exclusion** — instead of silently letting the backend arbitrate when both a file and pasted text are present, the UI disables the other input outright, closing a real correctness/trust gap before it can happen.

## Priority Issues

**[P1] Blank canvas during the app's single longest wait**
- **Why it matters**: `performAnalyze` clears `#results` entirely and shows only a 14px inline spinner inside the Analyze button while the backend reads a file and calls Claude — the two slowest operations in the app, and the moment right after a student has handed over their whole syllabus. A tiny button-level spinner is disproportionate feedback for a multi-second, high-stakes wait; users are likely to wonder if it's hung.
- **Fix**: Add a skeleton/placeholder state in `#results` (e.g. greyed section-shaped placeholders), or surface the existing "Reading file... / Analyzing with Claude..." staged text at a larger, more visible scale near the results area instead of only inside the button.
- **Suggested command**: $impeccable onboard (loading/status states) or $impeccable layout

**[P1] Raw backend strings surface as user-facing copy**
- **Why it matters**: `renderError` and the auth error region display server text verbatim (e.g. "Could not parse response," "Not logged in") with no rewriting layer. These read as developer messages, not guidance, and appear exactly when the user is already frustrated.
- **Fix**: Add a client-side map from known backend error messages to plain-language, actionable copy (e.g. "Could not parse response" → "Something went wrong reading that response — try again, or try a shorter syllabus.").
- **Suggested command**: $impeccable clarify

**[P1] No password recovery path exists**
- **Why it matters**: Signup only collects username + password; there's no email field and no "Forgot password?" link anywhere. Any student who forgets their password is permanently locked out of their saved syllabi with no recovery mechanism — a structural dead end, not just a rough edge.
- **Fix**: At minimum, add an email field at signup to enable a real reset flow, or explicitly set expectations in copy that this is a low-stakes local account with no recovery.
- **Suggested command**: $impeccable harden

**[P2] Sidebar doesn't scale past a handful of saved syllabi**
- **Why it matters**: No search/filter/sort in the saved list; rename/delete icons render unconditionally on every row instead of on hover/focus; no timestamp shown in the row (only deadline count), so two identically-named saves are indistinguishable without opening each. This directly punishes the app's own success case — a returning student saving one syllabus per class per semester.
- **Fix**: Add a lightweight filter once item count exceeds ~6, disclose rename/delete on hover/focus instead of always-on, surface the existing `created_at` value in the row.
- **Suggested command**: $impeccable layout

**[P2] Generic visual identity carries no domain signal**
- **Why it matters**: See Design Specificity Verdict — the product's differentiator is empathy for an anxious student reading dense legal-academic text, but the visual language is borrowed wholesale from generic B2B tooling, undercutting that positioning before a single word is read.
- **Fix**: Introduce at least one domain-specific visual anchor — a calendar/term-based motif in the deadline section, a grade-scale visual for the grading breakdown instead of a plain row list, or icon language drawn from academic objects rather than generic file/warning glyphs.
- **Suggested command**: $impeccable bolder or $impeccable delight

## Persona Red Flags

**Jordan (First-Timer)**
- Cannot try the core feature at all without creating a full username+password account first — both `/analyze` and `/extract-text` require login, so there's no way to see what the tool produces before committing to signup.
- The empty-sidebar CTA ("Analyze a syllabus below, then save it to keep it here") is styled as plain muted text with no button chrome — a first-timer is unlikely to recognize it's clickable.
- The file/paste exclusivity cue lives only in the divider text swap, a low-salience spot a first-timer skimming a decorative-looking "or paste it below" divider will likely miss, causing confusion about why one input isn't "taking."

**Sam (Accessibility)**
- Severity is signaled with a small colored dot in the sidebar. The parent row's `aria-label` does state severity for screen readers, but sighted colorblind users scanning visually have no non-color differentiator (no shape/icon change between the high/medium colors) — a WCAG 1.4.1 (use of color) gap.
- Disabled states stack `opacity: 0.5` on already-muted text — this compounds contrast loss on exactly the explanatory copy a low-vision user needs to read to understand why a control is greyed out.

**Riley (Stress-Tester)** — verified directly against source
- Renaming a saved item to blank/whitespace-only silently reverts with zero feedback (`confirmRename` trims the input and, if empty, just reloads the list — confirmed at `static/script.js:334-337`). A user probing edge cases gets a rename that appears to do nothing, with no explanation.
- Saving the same course name twice is not prevented anywhere in `/save` — the sidebar would show two indistinguishable rows differentiated only by deadline count, with no created-date visible to tell them apart.
- No stated file-size cap in the dropzone copy — a stress-tester uploading an oversized file gets no proactive warning and hits whatever raw error the backend happens to return.

## Minor Observations

- Auth wordmark hardcodes a `<br>` mid-phrase ("Syllabus<br>Translator") regardless of viewport/zoom — brittle at unusual font sizes.
- Toast durations vary (2500ms success / 5000ms undo / 6000ms warning) with no documented rationale — worth confirming this is deliberate rather than drift.
- `document.title` never changes contextually (stays "Syllabus Translator" even viewing a specific saved course) — minor multi-tab discoverability gap.
- "Plainly" is reused verbatim in both the auth tagline and the main-app subtitle — a consistent voice anchor, though borderline repetitive if a user sees both screens back to back.
- Dashboard silently sorts unparseable-date deadlines to the bottom with no visual flag that they'll be skipped on calendar export — the user only learns this after clicking Export and reading the resulting toast.

## Questions to Consider

1. Given the entire value proposition is "paste a syllabus, see what matters" — is gating the core feature behind mandatory account creation costing more first-time trust than the account system gains?
2. If the emotional job of this product is reducing anxiety about a dense, threatening document, should flags stay purely informational, or should each one carry a next action (e.g. "mark as noted") so a student leaves having *done* something about the risk, not just read about it?
3. Strip every copy string from this interface — would anything left over signal it's about syllabi at all? What's the one visual idea that could carry the domain the way the severity legend currently carries it alone?
