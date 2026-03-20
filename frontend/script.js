const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

if (!loggedInUser) {
    window.location.href = "login.html";
}

const API_BASE = "http://127.0.0.1:5000";

let currentBodyResponse = "Response will appear here...";
let currentFullResponse = "Full response will appear here...";
let activeTab = "body";

function saveResponseToStorage(status, time, responseText, fullResponseText) {
    localStorage.setItem("api_status", status);
    localStorage.setItem("api_time", time);
    localStorage.setItem("api_response", responseText);
    localStorage.setItem("api_full_response", fullResponseText);
}

function loadResponseFromStorage() {
    const status = localStorage.getItem("api_status");
    const time = localStorage.getItem("api_time");
    const response = localStorage.getItem("api_response");
    const fullResponse = localStorage.getItem("api_full_response");

    if (status !== null) {
        document.getElementById("statusCode").textContent = status;
    }

    if (time !== null) {
        document.getElementById("responseTime").textContent = time;
    }

    if (response !== null) {
        currentBodyResponse = response;
    }

    if (fullResponse !== null) {
        currentFullResponse = fullResponse;
    }

    renderActiveTab();
}

function clearResponseStorage() {
    localStorage.removeItem("api_status");
    localStorage.removeItem("api_time");
    localStorage.removeItem("api_response");
    localStorage.removeItem("api_full_response");
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
    clearResponseStorage();
    renderActiveTab();
}

async function copyResponse() {
    const textToCopy = activeTab === "body" ? currentBodyResponse : currentFullResponse;

    try {
        await navigator.clipboard.writeText(textToCopy);
        alert("Response copied successfully");
    } catch (error) {
        alert("Copy failed: " + error.message);
    }
}

function parseJsonInput(text, fieldName) {
    if (!text || !text.trim()) return {};

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Invalid JSON in ${fieldName}`);
    }
}

async function sendRequest(event) {
    if (event) event.preventDefault();

    const method = document.getElementById("method").value;
    const url = document.getElementById("url").value.trim();
    const headersText = document.getElementById("headers").value.trim();
    const bodyText = document.getElementById("body").value.trim();

    const statusEl = document.getElementById("statusCode");
    const timeEl = document.getElementById("responseTime");

    let headers = {};
    let body = {};

    if (!url) {
        alert("Please enter API URL");
        return;
    }

    try {
        headers = parseJsonInput(headersText, "headers");

        if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
            body = parseJsonInput(bodyText, "body");
        }
    } catch (error) {
        alert(error.message);
        return;
    }

    statusEl.textContent = "Loading...";
    timeEl.textContent = "Loading...";
    currentBodyResponse = "Sending request...";
    currentFullResponse = "Sending request...";
    renderActiveTab();

    try {
        const response = await fetch(`${API_BASE}/request`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ method, url, headers, body })
        });

        const data = await response.json();

        const finalStatus = data.status_code ?? (response.ok ? response.status : "Error");
        const finalTime = data.response_time_ms !== undefined
            ? `${data.response_time_ms} ms`
            : "-";

        if (data.error) {
            currentBodyResponse = `Error: ${data.error}`;
            currentFullResponse = JSON.stringify(data, null, 2);
        } else {
            currentBodyResponse =
                data.response !== undefined && data.response !== null
                    ? (typeof data.response === "object"
                        ? JSON.stringify(data.response, null, 2)
                        : String(data.response))
                    : "No response body found.";

            currentFullResponse = JSON.stringify(data, null, 2);
        }

        statusEl.textContent = finalStatus;
        timeEl.textContent = finalTime;

        saveResponseToStorage(finalStatus, finalTime, currentBodyResponse, currentFullResponse);
        renderActiveTab();

        await loadHistory();
    } catch (error) {
        statusEl.textContent = "Error";
        timeEl.textContent = "-";
        currentBodyResponse = "Error: " + error.message;
        currentFullResponse = "Error: " + error.message;

        saveResponseToStorage("Error", "-", currentBodyResponse, currentFullResponse);
        renderActiveTab();
    }
}

async function saveCollection(event) {
    if (event) event.preventDefault();

    const name = prompt("Enter collection name:");
    if (!name || !name.trim()) return;

    const method = document.getElementById("method").value;
    const url = document.getElementById("url").value.trim();
    const headersText = document.getElementById("headers").value.trim();
    const bodyText = document.getElementById("body").value.trim();

    let headers = {};
    let body = {};

    if (!url) {
        alert("Please enter API URL before saving collection");
        return;
    }

    try {
        headers = parseJsonInput(headersText, "headers");
        body = parseJsonInput(bodyText, "body");
    } catch (error) {
        alert(error.message);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: loggedInUser.id,
                name: name.trim(),
                method,
                url,
                headers,
                body
            })
        });

        const data = await response.json();
        alert(data.message || data.error || "Collection saved successfully");
        await loadCollections();
    } catch (error) {
        alert("Error saving collection: " + error.message);
    }
}

function loadCollectionToForm(item) {
    document.getElementById("method").value = item.method || "GET";
    document.getElementById("url").value = item.url || "";

    try {
        document.getElementById("headers").value = item.headers
            ? JSON.stringify(JSON.parse(item.headers), null, 2)
            : "";
    } catch (error) {
        document.getElementById("headers").value = item.headers || "";
    }

    try {
        document.getElementById("body").value = item.body
            ? JSON.stringify(JSON.parse(item.body), null, 2)
            : "";
    } catch (error) {
        document.getElementById("body").value = item.body || "";
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function editCollection(item) {
    const newName = prompt("Enter new collection name:", item.name);
    if (!newName || !newName.trim()) return;

    let parsedHeaders = {};
    let parsedBody = {};

    try {
        parsedHeaders = item.headers ? JSON.parse(item.headers) : {};
        parsedBody = item.body ? JSON.parse(item.body) : {};
    } catch (error) {
        alert("Collection data format is invalid");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/collections/${item.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: newName.trim(),
                method: item.method,
                url: item.url,
                headers: parsedHeaders,
                body: parsedBody
            })
        });

        const data = await response.json();
        alert(data.message || data.error || "Collection updated successfully");
        await loadCollections();
    } catch (error) {
        alert("Error updating collection: " + error.message);
    }
}

async function deleteCollection(collectionId) {
    const confirmDelete = confirm("Are you sure you want to delete this collection?");
    if (!confirmDelete) return;

    try {
        const response = await fetch(`${API_BASE}/collections/${collectionId}`, {
            method: "DELETE"
        });

        const data = await response.json();
        alert(data.message || data.error || "Collection deleted successfully");
        await loadCollections();
    } catch (error) {
        alert("Error deleting collection: " + error.message);
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/history`);
        const data = await response.json();

        const historyOutput = document.getElementById("historyOutput");
        historyOutput.innerHTML = "";

        if (!data || data.length === 0) {
            historyOutput.innerHTML = "<p>No history found.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "history-item";

            div.innerHTML = `
                <div class="item-top-row">
                    <span class="method-badge method-${(item.method || "GET").toLowerCase()}">${item.method || "GET"}</span>
                    <span class="status-badge">${item.status_code ?? "-"}</span>
                </div>
                <div class="item-url">${item.url || "-"}</div>
                <div class="item-date"><strong>Date:</strong> ${item.created_at || "-"}</div>
            `;

            historyOutput.appendChild(div);
        });
    } catch (error) {
        document.getElementById("historyOutput").innerHTML =
            `<p>Error loading history: ${error.message}</p>`;
    }
}

async function loadCollections() {
    try {
        const response = await fetch(`${API_BASE}/collections/${loggedInUser.id}`);
        const data = await response.json();

        const collectionsOutput = document.getElementById("collectionsOutput");
        collectionsOutput.innerHTML = "";

        if (!data || data.length === 0) {
            collectionsOutput.innerHTML = "<p>No collections found.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "collection-item";

            div.innerHTML = `
                <div class="item-top-row">
                    <strong>${item.name || "Untitled Collection"}</strong>
                    <span class="method-badge method-${(item.method || "GET").toLowerCase()}">${item.method || "GET"}</span>
                </div>
                <div class="item-url">${item.url || "-"}</div>
                <div class="item-date"><strong>Date:</strong> ${item.created_at || "-"}</div>
                <div class="collection-actions">
                    <button type="button" class="load-btn">Load</button>
                    <button type="button" class="edit-btn">Edit</button>
                    <button type="button" class="delete-btn">Delete</button>
                </div>
            `;

            div.querySelector(".load-btn").addEventListener("click", () => {
                loadCollectionToForm(item);
            });

            div.querySelector(".edit-btn").addEventListener("click", () => {
                editCollection(item);
            });

            div.querySelector(".delete-btn").addEventListener("click", () => {
                deleteCollection(item.id);
            });

            collectionsOutput.appendChild(div);
        });
    } catch (error) {
        document.getElementById("collectionsOutput").innerHTML =
            `<p>Error loading collections: ${error.message}</p>`;
    }
}

function logoutUser() {
    localStorage.removeItem("loggedInUser");
    clearResponseStorage();
    window.location.href = "login.html";
}

window.addEventListener("DOMContentLoaded", () => {
    loadHistory();
    loadCollections();
    loadResponseFromStorage();

    const sendBtn = document.getElementById("sendBtn");
    const saveBtn = document.getElementById("saveBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
    const refreshCollectionsBtn = document.getElementById("refreshCollectionsBtn");
    const copyResponseBtn = document.getElementById("copyResponseBtn");
    const clearResponseBtn = document.getElementById("clearResponseBtn");
    const bodyTabBtn = document.getElementById("bodyTabBtn");
    const fullTabBtn = document.getElementById("fullTabBtn");
    const urlInput = document.getElementById("url");
    const userInfo = document.getElementById("userInfo");
    const adminBtn = document.getElementById("adminBtn");

    if (sendBtn) sendBtn.addEventListener("click", sendRequest);
    if (saveBtn) saveBtn.addEventListener("click", saveCollection);
    if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);
    if (refreshHistoryBtn) refreshHistoryBtn.addEventListener("click", loadHistory);
    if (refreshCollectionsBtn) refreshCollectionsBtn.addEventListener("click", loadCollections);
    if (copyResponseBtn) copyResponseBtn.addEventListener("click", copyResponse);
    if (clearResponseBtn) clearResponseBtn.addEventListener("click", clearResponse);
    if (bodyTabBtn) bodyTabBtn.addEventListener("click", () => switchTab("body"));
    if (fullTabBtn) fullTabBtn.addEventListener("click", () => switchTab("full"));

    if (urlInput) {
        urlInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendRequest(event);
            }
        });
    }

    if (userInfo) {
        userInfo.textContent = `Logged in as: ${loggedInUser.username}`;
    }

    if (adminBtn && loggedInUser.is_admin) {
        adminBtn.style.display = "inline-block";
        adminBtn.addEventListener("click", () => {
            window.location.href = "admin.html";
        });
    }

    renderActiveTab();
});