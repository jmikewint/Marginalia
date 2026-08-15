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
            response = await fetch("/analyze", {
                method: "POST",
                body: formData
            });
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

        let html = "";

        if (data.flags && data.flags.length > 0) {
            html += `<div class="section"><h2>Watch out for</h2>`;
            data.flags.forEach(f => {
                html += `<div class="flag ${f.severity}">
                    <div class="flag-severity">${f.severity}</div>
                    ${f.text}
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
            html += `</div>`;
        }

        resultsDiv.innerHTML = html || `<div class="section">No data extracted.</div>`;

    } catch (err) {
        resultsDiv.innerHTML = `<div class="section">Something went wrong: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "Analyze";
    }
});