let currentData = null;
let isSignupMode = false;

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

    document.getElementById("save-btn").addEventListener("click", async () => {
        const courseName = prompt("Name this syllabus (e.g. 'CS 2000'):");
        if (!courseName) return;

        await fetch("/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_name: courseName, data: data })
        });

        loadSavedList();
    });
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
            <span><strong style="color:#666; font-size:12px;">${d.course}</strong><br>${d.item}</span>
            <strong>${d.date}</strong>
        </div>`;
    });
    html += `</div>`;
    resultsDiv.innerHTML = html;
}

document.getElementById("dashboard-btn").addEventListener("click", renderDashboard);

// ---- Analyze ----

document.getElementById("analyze-btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("syllabus-file");
    const text = document.getElementById("syllabus-input").value;
    const resultsDiv = document.getElementById("results");
    const btn = document.getElementById("analyze-btn");

    const hasFile = fileInput.files.length > 0;
    if (!hasFile && !text.trim()) return;

    btn.disabled = true;
    btn.textContent = "Analyzing...";
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
            resultsDiv.innerHTML = `<div class="section">Error: ${data.error}</div>`;
            return;
        }

        currentData = data;
        renderResults(data);

    } catch (err) {
        resultsDiv.innerHTML = `<div class="section">Something went wrong: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "Analyze";
    }
});

// ---- Init ----
checkAuth();