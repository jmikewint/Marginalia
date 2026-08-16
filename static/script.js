let currentData = null;
let isSignupMode = false;

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

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    document.getElementById("auth-title").textContent = isSignupMode ? "Sign Up" : "Log In";
    document.getElementById("auth-submit-btn").textContent = isSignupMode ? "Sign Up" : "Log In";
    document.getElementById("auth-toggle").textContent = isSignupMode
        ? "Already have an account? Log in"
        : "Don't have an account? Sign up";
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
    const password = document.getElementById("auth-password").value;
    const errorDiv = document.getElementById("auth-error");
    errorDiv.textContent = "";

    if (!username || !password) {
        errorDiv.textContent = "Please fill in both fields.";
        return;
    }

    const endpoint = isSignupMode ? "/signup" : "/login";
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.error) {
        errorDiv.textContent = data.error;
        return;
    }

    showApp(data.username);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/logout", { method: "POST" });
    showAuthScreen();
});

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

async function loadSavedList() {
    const res = await fetch("/saved");
    const items = await res.json();
    const listDiv = document.getElementById("saved-list");

    if (items.length === 0) {
        listDiv.innerHTML = `<span class="empty-note">None yet</span>`;
        return;
    }

    listDiv.innerHTML = items.map(item => `
        <div class="saved-item" data-id="${item.id}">
            <span class="saved-name" role="button" tabindex="0" aria-label="Open ${item.course_name}">${item.course_name}</span>
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
        </div>
    `).join("");

    async function openSavedItem(id) {
        const res = await fetch(`/saved/${id}`);
        const record = await res.json();
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
            const courseName = itemEl.querySelector(".saved-name").textContent;
            scheduleDelete(id, courseName, itemEl);
        });
    });

    document.querySelectorAll(".rename-btn").forEach(el => {
        el.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const itemEl = e.currentTarget.closest(".saved-item");
            const currentName = itemEl.querySelector(".saved-name").textContent;
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

function scheduleDelete(id, courseName, itemEl) {
    if (pendingDeletes.has(id)) return;

    itemEl.style.display = "none";
    const timer = setTimeout(() => finalizeDelete(id), 5000);
    pendingDeletes.set(id, { timer });

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
    pendingDeletes.delete(id);
    loadSavedList();
}

// ---- Results rendering ----

function renderResults(data) {
    const resultsDiv = document.getElementById("results");
    let html = "";

    if (data.flags && data.flags.length > 0) {
        html += `<div class="section"><h2>Watch out for</h2>`;
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
    resultsDiv.innerHTML = html;

    if (data.deadlines && data.deadlines.length > 0) {
        document.getElementById("export-cal-btn").addEventListener("click", async () => {
            const calResponse = await fetch("/export-calendar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deadlines: data.deadlines })
            });
            const blob = await calResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "syllabus-deadlines.ics";
            a.click();
            window.URL.revokeObjectURL(url);
        });
    }

    document.getElementById("save-btn").addEventListener("click", () => {
        openSaveModal(data);
    });
}

// ---- Save modal ----

let pendingSaveData = null;
let saveModalOpener = null;

function openSaveModal(data) {
    pendingSaveData = data;
    saveModalOpener = document.activeElement;
    const input = document.getElementById("save-course-name");
    document.getElementById("save-name-error").textContent = "";
    input.value = (data && data.course_name) || "";
    document.getElementById("save-modal-overlay").classList.remove("hidden");
    input.focus();
    input.select();
}

function closeSaveModal() {
    document.getElementById("save-modal-overlay").classList.add("hidden");
    pendingSaveData = null;
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
    const courseName = input.value.trim();

    if (!courseName) {
        errorDiv.textContent = "Enter a course name to save this syllabus.";
        input.focus();
        return;
    }

    await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_name: courseName, data: pendingSaveData })
    });

    closeSaveModal();
    loadSavedList();
    showToast(`Saved "${courseName}"`);
}

document.getElementById("save-modal-confirm").addEventListener("click", confirmSave);
document.getElementById("save-modal-cancel").addEventListener("click", closeSaveModal);
document.getElementById("save-modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "save-modal-overlay") closeSaveModal();
});
document.getElementById("save-course-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmSave();
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
    const resultsDiv = document.getElementById("results");

    if (data.deadlines.length === 0) {
        resultsDiv.innerHTML = `<div class="section">No saved syllabi yet. Analyze and save one first.</div>`;
        return;
    }

    let html = `<div class="section"><h2>All deadlines across ${data.course_count} saved ${data.course_count === 1 ? "syllabus" : "syllabi"}</h2>`;
    data.deadlines.forEach(d => {
        html += `<div class="deadline-row">
            <span><strong style="color: var(--text-muted); font-size:12px;">${d.course}</strong><br>${d.item}</span>
            <strong>${d.date}</strong>
        </div>`;
    });
    html += `</div>`;
    resultsDiv.innerHTML = html;
}

document.getElementById("dashboard-btn").addEventListener("click", renderDashboard);

// ---- Dropzone ----

const DROPZONE_ALLOWED_EXT = [".pdf", ".docx"];

function updateDropzoneUI() {
    const fileInput = document.getElementById("syllabus-file");
    const dropzoneEmpty = document.getElementById("dropzone-empty");
    const dropzoneFile = document.getElementById("dropzone-file");
    const dropzoneFilename = document.getElementById("dropzone-filename");
    const dropzoneError = document.getElementById("dropzone-error");
    const file = fileInput.files[0];

    dropzoneError.textContent = "";

    if (!file) {
        dropzoneEmpty.classList.remove("hidden");
        dropzoneFile.classList.add("hidden");
        return;
    }

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!DROPZONE_ALLOWED_EXT.includes(ext)) {
        fileInput.value = "";
        dropzoneError.textContent = "Please choose a PDF or Word (.docx) file.";
        dropzoneEmpty.classList.remove("hidden");
        dropzoneFile.classList.add("hidden");
        return;
    }

    dropzoneFilename.textContent = file.name;
    dropzoneEmpty.classList.add("hidden");
    dropzoneFile.classList.remove("hidden");
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

    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    const fileInput = document.getElementById("syllabus-file");
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

// ---- Analyze ----

async function performAnalyze() {
    const fileInput = document.getElementById("syllabus-file");
    const text = document.getElementById("syllabus-input").value;
    const resultsDiv = document.getElementById("results");
    const btn = document.getElementById("analyze-btn");

    const hasFile = fileInput.files.length > 0;
    if (!hasFile && !text.trim()) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>Analyzing...`;
    resultsDiv.innerHTML = "";

    try {
        let response;
        if (hasFile) {
            const formData = new FormData();
            formData.append("syllabus_file", fileInput.files[0]);
            response = await fetch("/analyze", { method: "POST", body: formData });
        } else {
            response = await fetch("/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syllabus_text: text })
            });
        }

        const data = await response.json();
        if (data.error) {
            renderError(data.error);
            return;
        }

        currentData = data;
        renderResults(data);

    } catch (err) {
        renderError(`Couldn't reach the server: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = "Analyze";
    }
}

document.getElementById("analyze-btn").addEventListener("click", performAnalyze);

// ---- Init ----
checkAuth();