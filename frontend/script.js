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

function renderActiveTab() {
    const responseEl = document.getElementById("responseOutput");
    const bodyTabBtn = document.getElementById("bodyTabBtn");
    const fullTabBtn = document.getElementById("fullTabBtn");

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
}

async function copyResponse() {
    try {
        const textToCopy = activeTab === "body" ? currentBodyResponse : currentFullResponse;
        await navigator.clipboard.writeText(textToCopy);
        alert("Copied to clipboard");
    } catch (error) {
        alert("Copy failed: " + error.message);
    }
}

function parseJsonInput(text, fieldName) {
    if (!text || !text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON in ${fieldName}`);
    }
}

async function sendRequest() {
    const method = document.getElementById("method").value;
    const url = document.getElementById("url").value.trim();

    if (!url) {
        alert("Please enter API URL");
        return;
    }

    let headers = {};
    let body = {};

    try {
        headers = parseJsonInput(document.getElementById("headers").value, "headers");
        body = parseJsonInput(document.getElementById("body").value, "body");
    } catch (error) {
        alert(error.message);
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
        document.getElementById("responseTime").textContent = data.response_time_ms ? `${data.response_time_ms} ms` : "-";

        currentBodyResponse = typeof data.response === "object"
            ? JSON.stringify(data.response, null, 2)
            : String(data.response ?? "");

        currentFullResponse = JSON.stringify(data, null, 2);
        renderActiveTab();
        loadHistory();
    } catch (err) {
        alert(err.message);
    }
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/history`, {
            headers: authOnlyHeaders()
        });

        const data = await res.json();
        const container = document.getElementById("historyOutput");
        container.innerHTML = "";

        if (!data.length) {
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
        console.error(err);
    }
}

async function clearHistory() {
    if (!confirm("Clear all your history?")) return;

    await fetch(`${API_BASE}/history/clear`, {
        method: "DELETE",
        headers: authOnlyHeaders()
    });

    loadHistory();
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
    } catch {
        alert("Invalid JSON");
        return;
    }

    await fetch(`${API_BASE}/save`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name, method, url, headers, body })
    });

    loadCollections();
}

function loadCollection(item) {
    document.getElementById("method").value = item.method;
    document.getElementById("url").value = item.url;
    document.getElementById("headers").value = item.headers;
    document.getElementById("body").value = item.body;
}

async function deleteCollection(id) {
    if (!confirm("Delete?")) return;

    await fetch(`${API_BASE}/collections/item/${id}`, {
        method: "DELETE",
        headers: authOnlyHeaders()
    });

    loadCollections();
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

    await fetch(`${API_BASE}/collections/item/${item.id}`, {
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

    loadCollections();
}

async function loadCollections() {
    const res = await fetch(`${API_BASE}/collections`, {
        headers: authOnlyHeaders()
    });

    const data = await res.json();
    const container = document.getElementById("collectionsOutput");
    container.innerHTML = "";

    if (!data.length) {
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
}

async function exportCollections() {
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
}

function openImportDialog() {
    document.getElementById("importFileInput").click();
}

async function importCollections(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const data = JSON.parse(text);

    await fetch(`${API_BASE}/collections/import`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            collections: data.collections || []
        })
    });

    loadCollections();
    e.target.value = "";
}

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

window.onload = () => {
    loadHistory();
    loadCollections();

    document.getElementById("sendBtn").onclick = sendRequest;
    document.getElementById("saveBtn").onclick = saveCollection;
    document.getElementById("logoutBtn").onclick = logout;
    document.getElementById("copyResponseBtn").onclick = copyResponse;
    document.getElementById("clearResponseBtn").onclick = clearResponse;
    document.getElementById("clearHistoryBtn").onclick = clearHistory;
    document.getElementById("bodyTabBtn").onclick = () => switchTab("body");
    document.getElementById("fullTabBtn").onclick = () => switchTab("full");
    document.getElementById("exportCollectionsBtn").onclick = exportCollections;
    document.getElementById("importCollectionsBtn").onclick = openImportDialog;
    document.getElementById("importFileInput").onchange = importCollections;
    document.getElementById("refreshCollectionsBtn").onclick = loadCollections;

    document.getElementById("userInfo").innerText = "Logged in as: " + loggedInUser.username;

    if (loggedInUser.is_admin) {
        const adminBtn = document.getElementById("adminBtn");
        adminBtn.style.display = "inline-block";
        adminBtn.onclick = () => {
            window.location.href = "admin.html";
        };
    }

    renderActiveTab();
};