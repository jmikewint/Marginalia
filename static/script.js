let currentData = null;
let isSignupMode = false;

// ---- Motion ----
// The CSS transition durations already collapse under prefers-reduced-motion
// (see the global override in style.css). This mirrors that for the JS side
// of animations, where we set a real timer to wait out a CSS transition
// before doing a final DOM change (e.g. hiding an element after it fades).
function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function transitionMs(ms) {
    return prefersReducedMotion() ? 0 : ms;
}

// ---- Dark mode ----

function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    updateThemeButton(saved);
}

function updateThemeButton(theme) {
    document.getElementById("theme-toggle").textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeButton(next);
});

initTheme();

// ---- Auth ----

async function checkAuth() {
    const res = await fetch("/me");
    const data = await res.json();

    if (data.username) {
        showApp(data.username);
    } else {
        showAuthScreen();
    }
}

function showAuthScreen() {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-screen").classList.add("hidden");
}

function showApp(username) {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    document.getElementById("username-display").textContent = username;
    loadSavedList();
}

// showAuthScreen/showApp stay instant - checkAuth() uses them on every page
// load to settle which screen belongs to the current session, which isn't a
// user-triggered transition and shouldn't animate. transitionToAuthScreen/
// transitionToApp wrap them for the two actions that ARE user-triggered:
// logging out, and a successful login/signup.
const SCREEN_TRANSITION_MS = 160;

function transitionToAuthScreen() {
    const appScreen = document.getElementById("app-screen");
    appScreen.classList.add("screen-fade");
    setTimeout(() => {
        showAuthScreen();
        appScreen.classList.remove("screen-fade");

        const authScreen = document.getElementById("auth-screen");
        authScreen.classList.add("screen-fade");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => authScreen.classList.remove("screen-fade"));
        });
    }, transitionMs(SCREEN_TRANSITION_MS));
}

function transitionToApp(username) {
    const authScreen = document.getElementById("auth-screen");
    authScreen.classList.add("screen-fade");
    setTimeout(() => {
        showApp(username);
        authScreen.classList.remove("screen-fade");

        const appScreen = document.getElementById("app-screen");
        appScreen.classList.add("screen-fade");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => appScreen.classList.remove("screen-fade"));
        });
    }, transitionMs(SCREEN_TRANSITION_MS));
}

const AUTH_MODE_FADE_MS = 150;

function fadeTextSwap(el, newText) {
    el.classList.add("text-fade-out");
    setTimeout(() => {
        el.textContent = newText;
        el.classList.remove("text-fade-out");
    }, transitionMs(AUTH_MODE_FADE_MS));
}

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    fadeTextSwap(document.getElementById("auth-title"), isSignupMode ? "Sign Up" : "Log In");
    fadeTextSwap(document.getElementById("auth-submit-btn"), isSignupMode ? "Sign Up" : "Log In");
    fadeTextSwap(document.getElementById("auth-toggle"), isSignupMode
        ? "Already have an account? Log in"
        : "Don't have an account? Sign up");
    document.getElementById("auth-email-group").classList.toggle("hidden", !isSignupMode);
    document.getElementById("forgot-password-link").classList.toggle("hidden", isSignupMode);
    document.getElementById("auth-error").textContent = "";
}

document.getElementById("auth-toggle").addEventListener("click", toggleAuthMode);
document.getElementById("auth-toggle").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleAuthMode();
    }
});

document.getElementById("auth-submit-btn").addEventListener("click", async () => {
    const username = document.getElementById("auth-username").value.trim();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const errorDiv = document.getElementById("auth-error");
    errorDiv.textContent = "";

    if (!username || !password || (isSignupMode && !email)) {
        errorDiv.textContent = "Please fill in all fields.";
        return;
    }

    const endpoint = isSignupMode ? "/signup" : "/login";
    const body = isSignupMode ? { username, email, password } : { username, password };
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.error) {
        errorDiv.textContent = data.error;
        return;
    }

    transitionToApp(data.username);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/logout", { method: "POST" });
    transitionToAuthScreen();
});

// ---- Password recovery ----

function showAuthPanel(name) {
    ["auth-box", "forgot-box", "reset-box"].forEach(id => {
        document.getElementById(id).classList.toggle("hidden", id !== name);
    });
}

function backToLogin() {
    if (window.location.search.includes("reset_token")) {
        history.replaceState({}, "", window.location.pathname);
    }
    showAuthPanel("auth-box");
}

function activateLinkOnKey(el, handler) {
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handler();
        }
    });
}

function openForgotPassword() {
    document.getElementById("forgot-email").value = "";
    document.getElementById("forgot-error").textContent = "";
    document.getElementById("forgot-result").innerHTML = "";
    showAuthPanel("forgot-box");
}

document.getElementById("forgot-password-link").addEventListener("click", openForgotPassword);
activateLinkOnKey(document.getElementById("forgot-password-link"), openForgotPassword);

document.getElementById("forgot-back").addEventListener("click", backToLogin);
activateLinkOnKey(document.getElementById("forgot-back"), backToLogin);
document.getElementById("reset-back").addEventListener("click", backToLogin);
activateLinkOnKey(document.getElementById("reset-back"), backToLogin);

document.getElementById("forgot-submit-btn").addEventListener("click", async () => {
    const email = document.getElementById("forgot-email").value.trim();
    const errorDiv = document.getElementById("forgot-error");
    const resultDiv = document.getElementById("forgot-result");
    const btn = document.getElementById("forgot-submit-btn");
    errorDiv.textContent = "";
    resultDiv.innerHTML = "";

    if (!email) {
        errorDiv.textContent = "Enter your email address.";
        return;
    }

    btn.disabled = true;
    try {
        const res = await fetch("/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (data.error) {
            errorDiv.textContent = data.error;
            return;
        }

        resultDiv.innerHTML = `<div class="reset-link-box">
            <a href="${data.reset_url}">${data.reset_url}</a>
            <span class="reset-link-note">${data.note}</span>
        </div>`;
    } finally {
        btn.disabled = false;
    }
});

let currentResetToken = null;

document.getElementById("reset-submit-btn").addEventListener("click", async () => {
    const password = document.getElementById("reset-password").value;
    const confirmPassword = document.getElementById("reset-password-confirm").value;
    const errorDiv = document.getElementById("reset-error");
    const btn = document.getElementById("reset-submit-btn");
    errorDiv.textContent = "";

    if (!password || !confirmPassword) {
        errorDiv.textContent = "Please fill in both fields.";
        return;
    }
    if (password.length < 6) {
        errorDiv.textContent = "Password must be at least 6 characters.";
        return;
    }
    if (password !== confirmPassword) {
        errorDiv.textContent = "Passwords don't match.";
        return;
    }

    btn.disabled = true;
    try {
        const res = await fetch("/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: currentResetToken, password })
        });
        const data = await res.json();

        if (data.error) {
            errorDiv.textContent = data.error;
            return;
        }

        history.replaceState({}, "", window.location.pathname);
        showAuthPanel("auth-box");
        showToast("Password updated. Log in with your new password.");
    } finally {
        btn.disabled = false;
    }
});

function checkResetTokenInUrl() {
    const token = new URLSearchParams(window.location.search).get("reset_token");
    if (!token) return false;

    currentResetToken = token;
    document.getElementById("reset-password").value = "";
    document.getElementById("reset-password-confirm").value = "";
    document.getElementById("reset-error").textContent = "";
    showAuthPanel("reset-box");
    return true;
}

// ---- Password visibility toggle ----

const EYE_ICON = `<path d="M1.5 9S4.5 3.5 9 3.5 16.5 9 16.5 9 13.5 14.5 9 14.5 1.5 9 1.5 9Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="9" r="2.25" stroke="currentColor" stroke-width="1.5"/>`;
const EYE_OFF_ICON = EYE_ICON + `<path d="M2.5 2.5l13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;

document.getElementById("password-toggle").addEventListener("click", () => {
    const input = document.getElementById("auth-password");
    const btn = document.getElementById("password-toggle");
    const icon = document.getElementById("password-toggle-icon");
    const showing = input.type === "text";

    input.type = showing ? "password" : "text";
    btn.setAttribute("aria-pressed", String(!showing));
    btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    icon.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
});

// ---- Saved syllabi sidebar ----

// Keep in sync with the initial markup in templates/index.html.
const SAVED_LIST_EMPTY_STATE = `
    <div class="empty-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
        <p class="empty-state-title">Nothing saved yet</p>
        <button type="button" class="empty-state-hint" id="empty-state-cta">Analyze a syllabus below, then save it to keep it here.</button>
    </div>
`;

function focusSyllabusInput() {
    const textarea = document.getElementById("syllabus-input");
    textarea.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    textarea.focus();
}

async function loadSavedList() {
    const res = await fetch("/saved");
    const items = await res.json();
    const listDiv = document.getElementById("saved-list");

    if (items.length === 0) {
        listDiv.innerHTML = SAVED_LIST_EMPTY_STATE;
        document.getElementById("empty-state-cta").addEventListener("click", focusSyllabusInput);
        return;
    }

    listDiv.innerHTML = items.map(item => {
        const deadlineText = item.deadline_count === 1 ? "1 deadline" : `${item.deadline_count} deadlines`;
        const severityLabel = item.flag_severity === "high" ? "high severity flags"
            : item.flag_severity === "medium" ? "medium severity flags"
            : "";
        const dot = item.flag_severity
            ? `<span class="saved-item-dot severity-${item.flag_severity}" aria-hidden="true"></span>`
            : "";

        return `
        <div class="saved-item" data-id="${item.id}">
            <span class="saved-name" role="button" tabindex="0" aria-label="Open ${item.course_name}, ${deadlineText}${severityLabel ? `, has ${severityLabel}` : ""}">
                <span class="saved-name-title">${dot}<span class="saved-name-text">${item.course_name}</span></span>
                <span class="saved-item-meta">${deadlineText}</span>
            </span>
            <div class="saved-item-actions">
                <button type="button" class="rename-btn" data-id="${item.id}" aria-label="Rename ${item.course_name}">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button type="button" class="delete-x" data-id="${item.id}" aria-label="Delete ${item.course_name}">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join("");

    async function openSavedItem(id) {
        const res = await fetch(`/saved/${id}`);
        const record = await res.json();
        if (record.error) {
            showToast(record.error, { variant: "warning" });
            loadSavedList();
            return;
        }
        currentData = record.data;
        renderResults(currentData);
    }

    document.querySelectorAll(".saved-name").forEach(el => {
        el.addEventListener("click", (e) => {
            openSavedItem(e.currentTarget.closest(".saved-item").dataset.id);
        });
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openSavedItem(e.currentTarget.closest(".saved-item").dataset.id);
            }
        });
    });

    document.querySelectorAll(".delete-x").forEach(el => {
        el.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const itemEl = e.currentTarget.closest(".saved-item");
            const courseName = itemEl.querySelector(".saved-name-text").textContent;
            scheduleDelete(id, courseName, itemEl);
        });
    });

    document.querySelectorAll(".rename-btn").forEach(el => {
        el.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const itemEl = e.currentTarget.closest(".saved-item");
            const currentName = itemEl.querySelector(".saved-name-text").textContent;
            enterRenameMode(itemEl, id, currentName);
        });
    });

    // Keep items whose deletion is still pending an undo hidden after a re-render
    pendingDeletes.forEach((_, id) => {
        const el = listDiv.querySelector(`.saved-item[data-id="${id}"]`);
        if (el) el.style.display = "none";
    });
}

// ---- Rename ----

function enterRenameMode(itemEl, id, currentName) {
    itemEl.classList.add("saved-item-editing");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "saved-name-input";
    input.value = currentName;
    input.setAttribute("aria-label", "Course name");

    itemEl.querySelector(".saved-name").replaceWith(input);

    const actions = itemEl.querySelector(".saved-item-actions");
    actions.innerHTML = `
        <button type="button" class="rename-confirm" aria-label="Save name">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
        <button type="button" class="rename-cancel" aria-label="Cancel rename">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
        </button>
    `;

    // A click on Confirm/Cancel blurs the input before its own click handler
    // runs, and rebuilding the list on commit/cancel removes the (still
    // focused) input, which fires blur again. `resolved` makes both of those
    // no-ops once the rename has genuinely been settled, so a blur only ever
    // triggers a cancel when the user actually clicked away.
    let resolved = false;
    const commit = () => { resolved = true; confirmRename(id, input.value); };
    const cancel = () => { resolved = true; loadSavedList(); };

    actions.querySelector(".rename-confirm").addEventListener("click", commit);
    actions.querySelector(".rename-cancel").addEventListener("click", cancel);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
    });
    input.addEventListener("blur", () => {
        setTimeout(() => {
            if (!resolved) cancel();
        }, 150);
    });

    input.focus();
    input.select();
}

async function confirmRename(id, newName) {
    const trimmed = newName.trim();
    if (!trimmed) {
        loadSavedList();
        return;
    }

    await fetch(`/saved/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_name: trimmed })
    });

    loadSavedList();
}

// ---- Delete with undo ----

const pendingDeletes = new Map();
const DELETE_COLLAPSE_MS = 250;

function scheduleDelete(id, courseName, itemEl) {
    if (pendingDeletes.has(id)) return;

    itemEl.classList.add("saved-item-removing");
    const collapseTimer = setTimeout(() => {
        itemEl.style.display = "none";
    }, transitionMs(DELETE_COLLAPSE_MS));

    const timer = setTimeout(() => finalizeDelete(id), 5000);
    pendingDeletes.set(id, { timer, collapseTimer });

    showToast(`Removed "${courseName}"`, {
        variant: "neutral",
        actionLabel: "Undo",
        onAction: () => undoDelete(id),
        duration: 5000
    });
}

async function finalizeDelete(id) {
    if (!pendingDeletes.has(id)) return;
    pendingDeletes.delete(id);
    try {
        await fetch(`/saved/${id}`, { method: "DELETE" });
    } finally {
        loadSavedList();
    }
}

function undoDelete(id) {
    const pending = pendingDeletes.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    clearTimeout(pending.collapseTimer);
    pendingDeletes.delete(id);
    loadSavedList();
}

// ---- Results rendering ----

const RESULTS_SWAP_MS = 150;

// Crossfades #results' content instead of the instant innerHTML replacement
// used elsewhere - this is specifically for switching between "a syllabus's
// results" and "the dashboard", which are visually unrelated layouts, not
// for every content update (e.g. performAnalyze clearing to a loading state
// stays instant, since animating a fade to empty right before a fetch just
// delays the spinner appearing).
function swapResultsHtml(html, afterSwap) {
    const resultsDiv = document.getElementById("results");

    if (!resultsDiv.innerHTML.trim()) {
        resultsDiv.innerHTML = html;
        if (afterSwap) afterSwap();
        return;
    }

    resultsDiv.classList.add("results-swapping");
    setTimeout(() => {
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove("results-swapping");
        if (afterSwap) afterSwap();
    }, transitionMs(RESULTS_SWAP_MS));
}

const SEVERITY_LEGEND_TEXT = `<strong style="color: var(--error-text);">High</strong> could seriously hurt your grade or standing. <strong style="color: var(--warning-text);">Medium</strong> is worth knowing, but less urgent.`;

// Shared by both the single-syllabus results view and the Dashboard's
// combined view, since both export the same {item, date} shaped deadlines
// to the same endpoint.
async function exportDeadlinesToCalendar(deadlines) {
    const calResponse = await fetch("/export-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadlines })
    });
    const skippedCount = parseInt(calResponse.headers.get("X-Skipped-Count") || "0", 10);
    const skippedItemsHeader = calResponse.headers.get("X-Skipped-Items");

    const blob = await calResponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "syllabus-deadlines.ics";
    a.click();
    window.URL.revokeObjectURL(url);

    if (skippedCount > 0) {
        const names = skippedItemsHeader ? decodeURIComponent(skippedItemsHeader) : "";
        const noun = skippedCount === 1 ? "deadline" : "deadlines";
        showToast(
            `${skippedCount} ${noun} couldn't be added (date not recognized)${names ? `: ${names}` : ""}.`,
            { variant: "warning", duration: 6000 }
        );
    }
}

function renderResults(data) {
    let html = "";

    if (data.flags && data.flags.length > 0) {
        html += `<div class="section"><h2>Watch out for</h2>
            <p class="section-hint">${SEVERITY_LEGEND_TEXT}</p>`;
        data.flags.forEach(f => {
            html += `<div class="flag ${f.severity}">
                <svg class="flag-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                    <path d="M8 6.2v3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <circle cx="8" cy="11.6" r="0.8" fill="currentColor"/>
                </svg>
                <div class="flag-body">
                    <div class="flag-severity">${f.severity}</div>${f.text}
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    if (data.grading && data.grading.length > 0) {
        html += `<div class="section"><h2>Grading breakdown</h2>`;
        data.grading.forEach(g => {
            html += `<div class="grading-row"><span>${g.component}</span><strong>${g.weight}</strong></div>`;
        });
        html += `</div>`;
    }

    if (data.deadlines && data.deadlines.length > 0) {
        html += `<div class="section"><h2>Key deadlines</h2>`;
        data.deadlines.forEach(d => {
            html += `<div class="deadline-row"><span>${d.item}</span><strong>${d.date}</strong></div>`;
        });
        html += `<button id="export-cal-btn" class="btn-secondary">Export to Calendar</button>`;
        html += `</div>`;
    }

    html += `<div style="margin-top:20px;"><button id="save-btn">Save this syllabus</button></div>`;

    swapResultsHtml(html, () => {
        if (data.deadlines && data.deadlines.length > 0) {
            document.getElementById("export-cal-btn").addEventListener("click", () => {
                exportDeadlinesToCalendar(data.deadlines);
            });
        }

        document.getElementById("save-btn").addEventListener("click", () => {
            openSaveModal(data);
        });
    });
}

// ---- Save modal ----

let pendingSaveData = null;
let pendingOverwriteId = null;
let saveModalOpener = null;
let closeModalTimer = null;
const MODAL_TRANSITION_MS = 180;

function openSaveModal(data) {
    pendingSaveData = data;
    pendingOverwriteId = null;
    saveModalOpener = document.activeElement;
    const input = document.getElementById("save-course-name");
    document.getElementById("save-name-error").textContent = "";
    document.getElementById("save-modal-confirm").textContent = "Save syllabus";
    input.value = (data && data.course_name) || "";

    clearTimeout(closeModalTimer);
    const overlay = document.getElementById("save-modal-overlay");
    overlay.classList.remove("hidden");
    // Two frames: the browser needs a paint between removing .hidden (so the
    // overlay actually exists in the layout) and adding .modal-open, or it
    // collapses the transition's starting and ending states into one jump.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add("modal-open"));
    });

    input.focus();
    input.select();
}

function closeSaveModal() {
    const overlay = document.getElementById("save-modal-overlay");
    overlay.classList.remove("modal-open");

    clearTimeout(closeModalTimer);
    closeModalTimer = setTimeout(() => overlay.classList.add("hidden"), transitionMs(MODAL_TRANSITION_MS));

    pendingSaveData = null;
    pendingOverwriteId = null;
    if (saveModalOpener) {
        saveModalOpener.focus();
        saveModalOpener = null;
    }
}

function trapSaveModalTab(e) {
    if (e.key !== "Tab") return;
    const focusable = [
        document.getElementById("save-course-name"),
        document.getElementById("save-modal-cancel"),
        document.getElementById("save-modal-confirm")
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

async function confirmSave() {
    const input = document.getElementById("save-course-name");
    const errorDiv = document.getElementById("save-name-error");
    const confirmBtn = document.getElementById("save-modal-confirm");
    const courseName = input.value.trim();

    if (!courseName) {
        errorDiv.textContent = "Enter a course name to save this syllabus.";
        input.focus();
        return;
    }

    // Disable both the button and Enter-to-submit's target so a double-click
    // or a stray double keypress can't fire two /save requests and create
    // duplicate rows - matches #analyze-btn's existing guard.
    confirmBtn.disabled = true;
    input.disabled = true;

    try {
        const res = await fetch("/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                course_name: courseName,
                data: pendingSaveData,
                overwrite_id: pendingOverwriteId
            })
        });
        const responseData = await res.json();

        if (responseData.error) {
            errorDiv.textContent = responseData.error;
            if (responseData.conflict === "duplicate_name") {
                pendingOverwriteId = responseData.existing_id;
                confirmBtn.textContent = "Overwrite existing";
            }
            return;
        }

        pendingOverwriteId = null;
        confirmBtn.textContent = "Save syllabus";
        closeSaveModal();
        loadSavedList();
        showToast(`Saved "${courseName}"`);
    } catch (err) {
        errorDiv.textContent = "Couldn't save right now. Check your connection and try again.";
    } finally {
        confirmBtn.disabled = false;
        input.disabled = false;
    }
}

document.getElementById("save-modal-confirm").addEventListener("click", confirmSave);
document.getElementById("save-modal-cancel").addEventListener("click", closeSaveModal);
document.getElementById("save-modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "save-modal-overlay") closeSaveModal();
});
document.getElementById("save-course-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmSave();
});
document.getElementById("save-course-name").addEventListener("input", () => {
    // Editing the name after a duplicate conflict means they're trying a
    // different name, not still confirming the same overwrite.
    if (pendingOverwriteId !== null) {
        pendingOverwriteId = null;
        document.getElementById("save-modal-confirm").textContent = "Save syllabus";
        document.getElementById("save-name-error").textContent = "";
    }
});
document.getElementById("save-modal").addEventListener("keydown", trapSaveModalTab);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("save-modal-overlay").classList.contains("hidden")) {
        closeSaveModal();
    }
});

// ---- Toast ----

let toastTimer = null;

const TOAST_ICONS = {
    success: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8.5L6.2 11.5L13 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    neutral: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 3v4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4.5 7C5.5 4.7 7.6 3 10 3c3.3 0 6 2.7 6 6s-2.7 6-6 6c-2.6 0-4.8-1.6-5.6-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.5 15 14H1L8 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8 6.2v3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="8" cy="11.6" r="0.8" fill="currentColor"/>
    </svg>`
};

function showToast(message, opts = {}) {
    const { variant = "success", actionLabel, onAction, duration = 2500 } = opts;
    const toast = document.getElementById("toast");

    toast.className = `toast-visible toast-${variant}`;
    toast.innerHTML = `${TOAST_ICONS[variant]}<span>${message}</span>` +
        (actionLabel ? `<button type="button" id="toast-action-btn">${actionLabel}</button>` : "");

    if (actionLabel && onAction) {
        const actionBtn = document.getElementById("toast-action-btn");
        actionBtn.addEventListener("click", () => {
            onAction();
            hideToast();
        });
        // Move focus to the action so keyboard/screen-reader users have a
        // direct path to it before the toast (and the action it undoes) expires.
        actionBtn.focus();
    }

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
    document.getElementById("toast").classList.remove("toast-visible");
}

// ---- Error state ----

function renderError(message) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = `
        <div class="section error">
            <div class="error-row">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="7.2" stroke="currentColor" stroke-width="1.6"/>
                    <path d="M9 5.5V9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    <circle cx="9" cy="12.2" r="0.9" fill="currentColor"/>
                </svg>
                <span>${message}</span>
            </div>
        </div>
    `;
    const section = resultsDiv.querySelector(".section.error");
    const retryBtn = document.createElement("button");
    retryBtn.id = "retry-btn";
    retryBtn.className = "btn-secondary";
    retryBtn.type = "button";
    retryBtn.textContent = "Try again";
    retryBtn.addEventListener("click", performAnalyze);
    section.appendChild(retryBtn);
}

async function renderDashboard() {
    const res = await fetch("/dashboard");
    const data = await res.json();

    if (data.deadlines.length === 0) {
        swapResultsHtml(`<div class="section">No saved syllabi yet. Analyze and save one first.</div>`);
        return;
    }

    let html = `<div class="section"><h2>All deadlines across ${data.course_count} saved ${data.course_count === 1 ? "syllabus" : "syllabi"}</h2>`;
    data.deadlines.forEach(d => {
        html += `<div class="deadline-row">
            <span><strong style="color: var(--text-muted); font-size:12px;">${d.course}</strong><br>${d.item}</span>
            <strong>${d.date}</strong>
        </div>`;
    });
    html += `<button id="dashboard-export-btn" class="btn-secondary">Export to Calendar</button>`;
    html += `</div>`;

    swapResultsHtml(html, () => {
        document.getElementById("dashboard-export-btn").addEventListener("click", () => {
            exportDeadlinesToCalendar(data.deadlines);
        });
    });
}

document.getElementById("dashboard-btn").addEventListener("click", renderDashboard);

// ---- Dropzone ----

const DROPZONE_ALLOWED_EXT = [".pdf", ".docx"];

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function updateDropzoneUI() {
    const fileInput = document.getElementById("syllabus-file");
    const dropzoneEmpty = document.getElementById("dropzone-empty");
    const dropzoneFile = document.getElementById("dropzone-file");
    const dropzoneFilename = document.getElementById("dropzone-filename");
    const dropzoneFilesize = document.getElementById("dropzone-filesize");
    const dropzoneError = document.getElementById("dropzone-error");
    const file = fileInput.files[0];

    dropzoneError.textContent = "";

    if (!file) {
        dropzoneEmpty.classList.remove("hidden");
        dropzoneFile.classList.add("hidden");
    } else {
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (!DROPZONE_ALLOWED_EXT.includes(ext)) {
            fileInput.value = "";
            dropzoneError.textContent = "Please choose a PDF or Word (.docx) file.";
            dropzoneEmpty.classList.remove("hidden");
            dropzoneFile.classList.add("hidden");
        } else {
            dropzoneFilename.textContent = file.name;
            dropzoneFilesize.textContent = formatFileSize(file.size);
            dropzoneEmpty.classList.add("hidden");
            dropzoneFile.classList.remove("hidden");
        }
    }

    updateInputAvailability();
}

// ---- File-vs-paste precedence ----
// The backend uses the file when both are present, so make that unambiguous
// in the UI: filling one disables the other rather than silently picking.

function updateInputAvailability() {
    const fileInput = document.getElementById("syllabus-file");
    const textarea = document.getElementById("syllabus-input");
    const dropzoneEl = document.getElementById("dropzone");
    const dividerLabel = document.querySelector(".divider span");
    const dropzoneHint = document.getElementById("dropzone-hint");

    const hasFile = fileInput.files.length > 0;
    const hasText = textarea.value.trim().length > 0;

    textarea.disabled = hasFile;
    fileInput.disabled = hasText;
    dropzoneEl.classList.toggle("dropzone-disabled", hasText);

    dividerLabel.textContent = hasFile ? "text disabled while a file is selected" : "or paste it below";
    dropzoneHint.innerHTML = hasText
        ? "Upload is disabled while you have pasted text"
        : `PDF or Word, or <span class="dropzone-browse">browse</span>`;
}

const dropzone = document.getElementById("dropzone");
document.getElementById("syllabus-file").addEventListener("change", updateDropzoneUI);

// Fallback: if a drop lands outside the dropzone itself, stop the browser
// from navigating to / opening the dropped file.
["dragover", "drop"].forEach(evt => {
    document.addEventListener(evt, (e) => e.preventDefault());
});

["dragenter", "dragover"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        if (document.getElementById("syllabus-file").disabled) return;
        dropzone.classList.add("dropzone-active");
    });
});
dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dropzone-active");
});
dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dropzone-active");

    const fileInput = document.getElementById("syllabus-file");
    if (fileInput.disabled) return;

    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    const dt = new DataTransfer();
    dt.items.add(dropped);
    fileInput.files = dt.files;
    updateDropzoneUI();
});

document.getElementById("dropzone-remove").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("syllabus-file").value = "";
    updateDropzoneUI();
});

document.getElementById("syllabus-input").addEventListener("input", updateInputAvailability);

// ---- Analyze ----

function setAnalyzeStage(label) {
    document.getElementById("analyze-btn").innerHTML = `<span class="spinner"></span>${label}`;
}

async function performAnalyze() {
    // Re-read the current file/text on every call rather than caching it, so
    // clicking "Try again" after a failure re-uses whatever is still
    // selected or pasted instead of needing it re-attached.
    const fileInput = document.getElementById("syllabus-file");
    const text = document.getElementById("syllabus-input").value;
    const resultsDiv = document.getElementById("results");
    const btn = document.getElementById("analyze-btn");

    const hasFile = fileInput.files.length > 0;
    if (!hasFile && !text.trim()) return;

    btn.disabled = true;
    setAnalyzeStage(hasFile ? "Reading file..." : "Analyzing with Claude...");
    resultsDiv.innerHTML = "";

    try {
        let syllabusText = text;

        // Extracting the file's text is its own request specifically so this
        // status update reflects a real, observed stage boundary (the
        // request completing) rather than a guessed delay before switching
        // to the next label.
        if (hasFile) {
            const formData = new FormData();
            formData.append("syllabus_file", fileInput.files[0]);
            const extractResponse = await fetch("/extract-text", { method: "POST", body: formData });
            const extractData = await extractResponse.json();
            if (extractData.error) {
                renderError(extractData.error);
                return;
            }
            syllabusText = extractData.text;
            setAnalyzeStage("Analyzing with Claude...");
        }

        const response = await fetch("/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ syllabus_text: syllabusText })
        });

        const data = await response.json();
        if (data.error) {
            renderError(data.error);
            return;
        }

        currentData = data;
        renderResults(data);

    } catch (err) {
        renderError("Couldn't reach the server. Check your connection and try again.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Analyze";
    }
}

document.getElementById("analyze-btn").addEventListener("click", performAnalyze);

// ---- Init ----
if (checkResetTokenInUrl()) {
    showAuthScreen();
} else {
    checkAuth();
}