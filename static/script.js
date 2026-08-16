let currentData = null;
let isSignupMode = false;

// ---- Dark mode ----

function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    updateThemeButton(saved);
}

function updateThemeButton(theme) {
    document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode";
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

document.getElementById("auth-toggle").addEventListener("click", () => {
    isSignupMode = !isSignupMode;
    document.getElementById("auth-title").textContent = isSignupMode ? "Sign Up" : "Log In";
    document.getElementById("auth-submit-btn").textContent = isSignupMode ? "Sign Up" : "Log In";
    document.getElementById("auth-toggle").textContent = isSignupMode
        ? "Already have an account? Log in"
        : "Don't have an account? Sign up";
    document.getElementById("auth-error").textContent = "";
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
            <span class="saved-name">${item.course_name}</span>
            <span class="delete-x" data-id="${item.id}">✕</span>
        </div>
    `).join("");

    document.querySelectorAll(".saved-name").forEach(el => {
        el.addEventListener("click", async (e) => {
            const id = e.target.closest(".saved-item").dataset.id;
            const res = await fetch(`/saved/${id}`);
            const record = await res.json();
            currentData = record.data;
            renderResults(currentData);
        });
    });

    document.querySelectorAll(".delete-x").forEach(el => {
        el.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = e.target.dataset.id;
            await fetch(`/saved/${id}`, { method: "DELETE" });
            loadSavedList();
        });
    });
}

// ---- Results rendering ----

function renderResults(data) {
    const resultsDiv = document.getElementById("results");
    let html = "";

    if (data.flags && data.flags.length > 0) {
        html += `<div class="section"><h2>Watch out for</h2>`;
        data.flags.forEach(f => {
            html += `<div class="flag ${f.severity}"><div class="flag-severity">${f.severity}</div>${f.text}</div>`;
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
        html += `<button id="export-cal-btn">Export to Calendar</button>`;
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

function openSaveModal(data) {
    pendingSaveData = data;
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
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("save-modal-overlay").classList.contains("hidden")) {
        closeSaveModal();
    }
});

// ---- Toast ----

let toastTimer = null;

function showToast(message) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-message").textContent = message;
    toast.classList.add("toast-visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("toast-visible");
    }, 2500);
}

// ---- Error state ----

function renderError(message) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = `
        <div class="section error">
            <div class="error-row">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="7.25" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M9 5.5V9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
        resultsDiv.innerHTML = `<div class="section">No saved syllabi yet — analyze and save one first.</div>`;
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