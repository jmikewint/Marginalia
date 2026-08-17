---
target: templates/index.html (Syllabus Translator main UI)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-17T02-34-45Z
slug: templates-index-html
---
Method: dual-agent (A: aff7994c24ceaf2b9 · B: aa6554d5cd5bd4dcd)
⚠️ Both assessments ran code-based, not browser-based: no browser/screenshot tool exists in this session at all (confirmed independently by both agents — a hard capability gap, not a decline). Findings below are traceable to exact source lines, not visual observation. Treat layout/rendering claims as derived from tracing CSS box model and JS logic, not confirmed on-screen.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Staged analyze text is genuine, but `#save-modal-confirm` shows no in-flight state during its `fetch` |
| 2 | Match System / Real World | 4 | Language matches the student's actual stakes ("could seriously hurt your grade or standing") |
| 3 | User Control and Freedom | 3 | Undo-delete and Escape/Cancel are solid; no path back to a last-viewed syllabus from Dashboard except re-clicking the sidebar |
| 4 | Consistency and Standards | 3 | 44px touch-target technique exists and is documented, but applied to only 3 of ~7 controls that need it |
| 5 | Error Prevention | 3 | Password's 6-char minimum has no client-side hint; only discovered after a failed round trip |
| 6 | Recognition Rather Than Recall | 3 | Severity dots + deadline counts in the sidebar are good; the legend's collapse reintroduces recall it was designed to prevent |
| 7 | Flexibility and Efficiency | 2 | No keyboard submit for analyze; Dashboard (the aggregation view) has no calendar export unlike single-syllabus results |
| 8 | Aesthetic and Minimalist Design | 3 | Clean tokens and restraint; grading/deadline rows carry zero visual weight signal despite wildly different stakes (5% quiz vs. 40% final) |
| 9 | Error Recovery | 3 | Retry correctly preserves file/text; messages are generic with no next step beyond identical retry |
| 10 | Help and Documentation | 1 | No onboarding, no sample syllabus, no preview of what "flags" will contain before first use |
| **Total** | | **28/40** | **Good — solid foundation, address the weak areas** |

## Design Specificity Verdict

**LLM assessment (Assessment A):** This is not a generic form-and-list app. The copy, the severity-flag color coding, the two-stage extract→analyze status text tied to real request boundaries, and the file-vs-paste mutual-exclusion handling all show specific thought for a stressed student parsing a dense document. But specificity is uneven: the grading breakdown and deadlines — the two sections where "what matters more" should be most visually obvious — render as flat, undifferentiated text rows. The app's core promise is weakest exactly where it should be strongest.

**Deterministic scan (Assessment B):** `detect.mjs` ran against both `templates/index.html` and `static/style.css`, exit 0, zero findings in both — but in degraded regex-fallback mode (no custom-property resolution, no selector matching, no computed contrast; confirmed via the tool's own stderr). A third attempt at Puppeteer-based URL scanning (which would have given real computed/rendered evidence) failed because `puppeteer` isn't installed in this environment. Read the empty result as "the scan didn't run meaningfully," not "clean."

**Code-verified findings the detector's regex pass couldn't catch** (Assessment B, evidenced with exact lines and computed contrast ratios):
- Touch-target expansion (`::before { inset: -Npx }`) is applied to `#password-toggle`, `.dropzone-remove`, and `.legend-info` — but not to `#auth-toggle`, `.empty-state-hint`, `#theme-toggle`, or `#logout-btn`, all real interactive controls sitting well under 44px.
- The focus `box-shadow` glow (`--accent-soft`) is functionally invisible in both themes: computed contrast against `--card-bg`/`--bg` is ~1.17:1 (light) and ~1.2:1 (dark) — near-isoluminant. The primary focus signal (border-color flip) still works, so this isn't a full failure, just a dead visual detail.
- `.saved-item-dot`'s CSS only defines fill color for `.severity-high`/`.severity-medium`; the JS renders the dot class for any truthy `flag_severity`. Not currently exploitable (the backend only ever emits `"high"`/`"medium"`/`null`, confirmed against `app.py`), but it's an unguarded assumption, not a defensive one.

## Overall Impression

Real, substantial progress since the first critique (16→28). The app now has a coherent identity, a disciplined and honestly-implemented motion system, and UX details (progressive legend, staged status, undo-delete) that show real design thinking rather than checkbox compliance. But two things are pulling the score down from "excellent": a genuine correctness bug (double-submit creates duplicate saves), and a pattern where good techniques (the 44px touch-target trick, the results/grading hierarchy) were applied to some of the relevant elements and not others.

## What's Working

1. **The two-stage extract→analyze flow is honest engineering, not decoration.** `/extract-text` exists as a separate request specifically so "Reading file..." reflects a real completed step, not a timed guess.
2. **Undo-based delete instead of a blocking confirm dialog**, with an animated collapse — a modern, low-friction pattern that respects flow, even though the window itself runs a little short for the stakes involved.
3. **The `@property`-based theme crossfade has a real, correct `prefers-reduced-motion` fallback** that collapses every transition to near-zero — genuinely sophisticated, and the accessibility path was actually implemented, not just claimed.

## Priority Issues

**[P1] Double-clicking "Save syllabus" creates duplicate rows**
Location: `confirmSave()` in `static/script.js`. `confirmSave()` never disables `#save-modal-confirm` or the input during its `await fetch("/save", ...)`. A rapid double-click fires two independent `/save` POSTs; `/save` has no idempotency guard, so it inserts twice. A real correctness bug, not a UX nicety.
Fix: Disable the confirm button (and Enter-to-submit) the instant the request starts, matching `#analyze-btn`'s pattern.
Suggested command: `$impeccable harden`

**[P1] Mobile layout buries the primary action below an empty sidebar**
Location: `#sidebar { order: -1; }` in `static/style.css`, never reset inside `@media (max-width: 700px)`. The mobile query only adds `flex-direction: column`; the sidebar (user bar + empty "Saved Syllabi") renders above the dropzone/textarea/Analyze button on the platform most students will use.
Fix: Reset `order` inside the mobile breakpoint so `#main` leads.
Suggested command: `$impeccable adapt`

**[P1] Dashboard has no calendar export**
Location: `renderDashboard()` in `static/script.js`. `renderResults()` attaches `#export-cal-btn`; `renderDashboard()` never does, despite `/dashboard` returning identically-shaped deadlines. The one view aggregating deadlines across every saved syllabus is the one place a student can't get them into one `.ics` file.
Fix: Add the same export button to `renderDashboard()`.
Suggested command: `$impeccable harden`

**[P1] The progressive severity legend's "3 views" budget doesn't match real usage**
Location: `FLAGS_LEGEND_FULL_VIEWS` / `recordFlagsLegendSeen()` in `static/script.js`. The counter is a raw lifetime view count. A student batch-analyzing 4-5 syllabi at semester start burns the entire budget within minutes and gets the collapsed "?" for class #4 with no actual memory of what high/medium means.
Fix: Gate on distinct days/sessions instead of raw views, or reconsider the collapse entirely.
Suggested command: `$impeccable clarify`

**[P2] Touch-target treatment is inconsistent across the app's own standard**
Location: base `button` rule for `#analyze-btn`/`#auth-submit-btn`/`#save-modal-confirm` (~38-39px); `#auth-toggle`, `.empty-state-hint`, `#theme-toggle`, `#logout-btn` (no expansion, some ~20-24px). The invisible `::before` expansion technique is documented and correctly applied to 3 controls but missed on the app's actual primary CTAs and four other real interactive elements.
Fix: Extend the same technique (or direct padding increase) to the missed controls.
Suggested command: `$impeccable adapt`

## Persona Red Flags

**Alex (impatient power user, batch-analyzing a full semester's syllabi):** Burns through the severity legend's "3 full views" within ~10 minutes of the app's most natural workflow. No `Ctrl`/`Cmd`+`Enter` to submit. After saving all 5, the Dashboard's combined deadline list has no export.

**Riley (stress tester):** Double-clicking "Save syllabus" before the first request resolves creates two identical rows. Refreshing during the 5-second undo window silently no-ops the delete since `pendingDeletes` is in-memory only — the item just reappears with no explanation.

**Jordan (confused first-timer):** `.empty-state-hint` is deliberately stripped of button styling to read as plain caption text, but with no underline and a hover-only affordance a touch user never sees, has no visual reason to click it. Signup's password field shows no minimum-length hint anywhere in the DOM.

## Minor Observations

- Focus-visible `box-shadow` glow computes to ~1.17-1.2:1 contrast in both themes — effectively invisible (border-color focus signal still works).
- `.saved-item-dot` severity CSS only covers `high`/`medium` explicitly; currently safe but not defensively written.
- Disabled-state divider copy ("text disabled while a file is selected") reads flatter than the rest of the app's voice.
- Generic error messages give no next step beyond an identical retry.
- `.legend-tooltip` has no viewport-edge collision handling on narrow screens.
- The Claude prompt allows 3-6 flags but the frontend renders them in one flat list, exceeding the 4-item chunking guideline in the highest-stakes section.

## Questions to Consider

- What if the grading breakdown showed relative weight visually (a bar per component) instead of matching the deadlines list's plain styling?
- What if the severity legend never collapsed at all, given the state it costs versus the ~2 sentences of space it saves?
- What if Analyze accepted a whole semester's syllabi in one pass instead of one-at-a-time-then-separately-saved?
