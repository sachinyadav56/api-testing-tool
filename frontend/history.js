const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token || !loggedInUser.is_admin) {
    window.location.href = "login.html";
}

function authOnlyHeaders() {
    return {
        "Authorization": `Bearer ${token}`
    };
}

function authJsonHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/admin/history`, {
            headers: authOnlyHeaders()
        });

        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch {
            document.getElementById("historyTableBody").innerHTML =
                `<tr><td colspan="6">Backend returned HTML instead of JSON. Check /admin/history route.</td></tr>`;
            return;
        }

        const tbody = document.getElementById("historyTableBody");
        tbody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">No history found.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><input type="checkbox" class="history-checkbox" value="${item.id}"></td>
                <td>${item.username || "-"}</td>
                <td>${item.method || "-"}</td>
                <td>${item.status_code || "-"}</td>
                <td>${item.url || "-"}</td>
                <td>${item.created_at || "-"}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        document.getElementById("historyTableBody").innerHTML =
            `<tr><td colspan="6">Error loading history: ${error.message}</td></tr>`;
    }
}

async function deleteSelectedHistory() {
    const checked = document.querySelectorAll(".history-checkbox:checked");
    const ids = Array.from(checked).map(item => Number(item.value));

    if (ids.length === 0) {
        alert("Select at least one history item");
        return;
    }

    if (!confirm("Delete selected history?")) return;

    try {
        const response = await fetch(`${API_BASE}/admin/history/delete`, {
            method: "POST",
            headers: authJsonHeaders(),
            body: JSON.stringify({ ids })
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadHistory();
    } catch (error) {
        alert("Error deleting history: " + error.message);
    }
}

function toggleAllHistory() {
    const main = document.getElementById("selectAllHistory");
    const items = document.querySelectorAll(".history-checkbox");
    items.forEach(item => {
        item.checked = main.checked;
    });
}

window.addEventListener("DOMContentLoaded", () => {
    loadHistory();
    document.getElementById("deleteSelectedHistoryBtn").addEventListener("click", deleteSelectedHistory);
    document.getElementById("selectAllHistory").addEventListener("change", toggleAllHistory);
});