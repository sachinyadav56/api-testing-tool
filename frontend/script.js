const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "login.html";
}

const API_BASE = window.location.origin;

let currentBodyResponse = "Response will appear here...";
let currentFullResponse = "Full response will appear here...";
let activeTab = "body";

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function authOnlyHeaders() {
    return {
        "Authorization": `Bearer ${token}`
    };
}

function parseJsonInput(text, fieldName) {
    if (!text || !text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON in ${fieldName}`);
    }
}

function renderActiveTab() {
    const responseEl = document.getElementById("responseOutput");
    const bodyTabBtn = document.getElementById("bodyTabBtn");
    const fullTabBtn = document.getElementById("fullTabBtn");

    if (!responseEl || !bodyTabBtn || !fullTabBtn) return;

    if (activeTab === "body") {
        responseEl.innerText = currentBodyResponse;
        bodyTabBtn.classList.add("active-tab");
        fullTabBtn.classList.remove("active-tab");
    } else {
        responseEl.innerText = currentFullResponse;
        fullTabBtn.classList.add("active-tab");
        bodyTabBtn.classList.remove("active-tab");
    }
}

function switchTab(tabName) {
    activeTab = tabName;
    renderActiveTab();
}

function clearResponse() {
    document.getElementById("statusCode").textContent = "-";
    document.getElementById("responseTime").textContent = "-";
    currentBodyResponse = "Response will appear here...";
    currentFullResponse = "Full response will appear here...";
    renderActiveTab();
    showToast("Response cleared", "info");
}

function clearRequestFields() {
    document.getElementById("method").value = "GET";
    document.getElementById("url").value = "";
    document.getElementById("headers").value = "";
    document.getElementById("body").value = "";
}

function ensureToastContainer() {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    return container;
}

function showToast(message, type = "success") {
    const container = ensureToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent =
        type === "success" ? "✓" :
        type === "error" ? "✕" :
        type === "info" ? "i" : "!";

    const text = document.createElement("span");
    text.className = "toast-text";
    text.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    };

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

async function copyResponse() {
    try {
        const textToCopy = activeTab === "body" ? currentBodyResponse : currentFullResponse;
        await navigator.clipboard.writeText(textToCopy);
        showToast("Response copied", "success");
    } catch (error) {
        showToast("Copy failed: " + error.message, "error");
    }
}

async function sendRequest() {
    const method = document.getElementById("method").value;
    const url = document.getElementById("url").value.trim();

    if (!url) {
        showToast("Please enter API URL", "error");
        return;
    }

    let headers = {};
    let body = {};

    try {
        headers = parseJsonInput(document.getElementById("headers").value, "headers");
        body = parseJsonInput(document.getElementById("body").value, "body");
    } catch (error) {
        showToast(error.message, "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/request`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ method, url, headers, body })
        });

        const data = await response.json();

        document.getElementById("statusCode").textContent = data.status_code ?? "-";
        document.getElementById("responseTime").textContent = data.response_time_ms
            ? `${data.response_time_ms} ms`
            : "-";

        currentBodyResponse = typeof data.response === "object"
            ? JSON.stringify(data.response, null, 2)
            : String(data.response ?? "");

        currentFullResponse = JSON.stringify(data, null, 2);

        renderActiveTab();
        await loadHistory();

        if (response.ok && !data.error) {
            showToast("Request sent successfully", "success");
            clearRequestFields();
        } else {
            showToast(data.error || "Request failed", "error");
        }
    } catch (err) {
        showToast("Request failed: " + err.message, "error");
    }
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/history`, {
            headers: authOnlyHeaders()
        });

        const data = await res.json();
        const container = document.getElementById("historyOutput");
        if (!container) return;

        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = "<p>No history</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "history-item";
            div.innerHTML = `
                <strong>${item.method}</strong> - ${item.status_code}<br>
                ${item.url}<br>
                <small>${item.created_at}</small>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        const container = document.getElementById("historyOutput");
        if (container) {
            container.innerHTML = `<p>Error loading history: ${err.message}</p>`;
        }
    }
}

async function clearHistory() {
    if (!confirm("Clear all your history?")) return;

    try {
        const res = await fetch(`${API_BASE}/history/clear`, {
            method: "DELETE",
            headers: authOnlyHeaders()
        });

        const data = await res.json();
        showToast(data.message || data.error || "History cleared", res.ok ? "success" : "error");
        await loadHistory();
    } catch (err) {
        showToast("Error clearing history: " + err.message, "error");
    }
}

async function saveCollection() {
    const name = prompt("Collection name:");
    if (!name) return;

    const method = document.getElementById("method").value;
    const url = document.getElementById("url").value.trim();

    let headers = {};
    let body = {};

    try {
        headers = parseJsonInput(document.getElementById("headers").value, "headers");
        body = parseJsonInput(document.getElementById("body").value, "body");
    } catch (error) {
        showToast(error.message, "error");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/save`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ name, method, url, headers, body })
        });

        const data = await res.json();
        showToast(data.message || data.error || "Collection saved", res.ok ? "success" : "error");
        await loadCollections();
    } catch (err) {
        showToast("Error saving collection: " + err.message, "error");
    }
}

function loadCollection(item) {
    document.getElementById("method").value = item.method || "GET";
    document.getElementById("url").value = item.url || "";

    try {
        document.getElementById("headers").value = item.headers
            ? JSON.stringify(JSON.parse(item.headers), null, 2)
            : "";
    } catch {
        document.getElementById("headers").value = item.headers || "";
    }

    try {
        document.getElementById("body").value = item.body
            ? JSON.stringify(JSON.parse(item.body), null, 2)
            : "";
    } catch {
        document.getElementById("body").value = item.body || "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Collection loaded into form", "success");
}

async function editCollection(item) {
    const newName = prompt("Enter collection name:", item.name);
    if (!newName) return;

    let headers = {};
    let body = {};

    try {
        headers = item.headers ? JSON.parse(item.headers) : {};
        body = item.body ? JSON.parse(item.body) : {};
    } catch {
        headers = {};
        body = {};
    }

    try {
        const res = await fetch(`${API_BASE}/collections/item/${item.id}`, {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify({
                name: newName,
                method: item.method,
                url: item.url,
                headers,
                body
            })
        });

        const data = await res.json();
        showToast(data.message || data.error || "Collection updated", res.ok ? "success" : "error");
        await loadCollections();
    } catch (err) {
        showToast("Error updating collection: " + err.message, "error");
    }
}

async function deleteCollection(id) {
    if (!confirm("Delete this collection?")) return;

    try {
        const res = await fetch(`${API_BASE}/collections/item/${id}`, {
            method: "DELETE",
            headers: authOnlyHeaders()
        });

        const data = await res.json();
        showToast(data.message || data.error || "Collection deleted", res.ok ? "success" : "error");
        await loadCollections();
    } catch (err) {
        showToast("Error deleting collection: " + err.message, "error");
    }
}

async function loadCollections() {
    try {
        const res = await fetch(`${API_BASE}/collections`, {
            headers: authOnlyHeaders()
        });

        const data = await res.json();
        const container = document.getElementById("collectionsOutput");
        if (!container) return;

        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = "<p>No collections found.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "collection-item";

            div.innerHTML = `
                <strong>${item.name}</strong> (${item.method})<br>
                ${item.url}
                <div class="table-actions" style="margin-top:10px;">
                    <button class="load-btn">Load</button>
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </div>
            `;

            div.querySelector(".load-btn").addEventListener("click", () => loadCollection(item));
            div.querySelector(".edit-btn").addEventListener("click", () => editCollection(item));
            div.querySelector(".delete-btn").addEventListener("click", () => deleteCollection(item.id));

            container.appendChild(div);
        });
    } catch (err) {
        const container = document.getElementById("collectionsOutput");
        if (container) {
            container.innerHTML = `<p>Error loading collections: ${err.message}</p>`;
        }
    }
}

async function exportCollections() {
    try {
        const res = await fetch(`${API_BASE}/collections/export`, {
            headers: authOnlyHeaders()
        });

        const data = await res.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json"
        });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "collections.json";
        a.click();

        showToast("Collections exported", "success");
    } catch (err) {
        showToast("Export failed: " + err.message, "error");
    }
}

function openImportDialog() {
    const input = document.getElementById("importFileInput");
    if (input) input.click();
}

async function importCollections(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        const res = await fetch(`${API_BASE}/collections/import`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                collections: data.collections || []
            })
        });

        const result = await res.json();
        showToast(result.message || result.error || "Import completed", res.ok ? "success" : "error");
        await loadCollections();
    } catch (err) {
        showToast("Import failed: " + err.message, "error");
    }

    e.target.value = "";
}

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

window.onload = () => {
    loadHistory();
    loadCollections();

    const sendBtn = document.getElementById("sendBtn");
    const saveBtn = document.getElementById("saveBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const copyResponseBtn = document.getElementById("copyResponseBtn");
    const clearResponseBtn = document.getElementById("clearResponseBtn");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    const bodyTabBtn = document.getElementById("bodyTabBtn");
    const fullTabBtn = document.getElementById("fullTabBtn");
    const exportCollectionsBtn = document.getElementById("exportCollectionsBtn");
    const importCollectionsBtn = document.getElementById("importCollectionsBtn");
    const importFileInput = document.getElementById("importFileInput");
    const refreshCollectionsBtn = document.getElementById("refreshCollectionsBtn");
    const userInfo = document.getElementById("userInfo");
    const adminBtn = document.getElementById("adminBtn");

    if (sendBtn) sendBtn.onclick = sendRequest;
    if (saveBtn) saveBtn.onclick = saveCollection;
    if (logoutBtn) logoutBtn.onclick = logout;
    if (copyResponseBtn) copyResponseBtn.onclick = copyResponse;
    if (clearResponseBtn) clearResponseBtn.onclick = clearResponse;
    if (clearHistoryBtn) clearHistoryBtn.onclick = clearHistory;
    if (bodyTabBtn) bodyTabBtn.onclick = () => switchTab("body");
    if (fullTabBtn) fullTabBtn.onclick = () => switchTab("full");
    if (exportCollectionsBtn) exportCollectionsBtn.onclick = exportCollections;
    if (importCollectionsBtn) importCollectionsBtn.onclick = openImportDialog;
    if (importFileInput) importFileInput.onchange = importCollections;
    if (refreshCollectionsBtn) refreshCollectionsBtn.onclick = loadCollections;

    if (userInfo) {
        userInfo.innerText = "Logged in as: " + loggedInUser.username;
    }

    if (loggedInUser.is_admin && adminBtn) {
        adminBtn.style.display = "inline-block";
        adminBtn.onclick = () => {
            window.location.href = "admin.html";
        };
    }

    renderActiveTab();
};