const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "/login.html";
}

if (!loggedInUser.is_admin) {
    window.location.href = "/dashboard.html";
}

let allCollections = [];

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

async function loadCollections() {
    try {
        const response = await fetch(`${API_BASE}/admin/collections`, {
            headers: authOnlyHeaders()
        });

        const text = await response.text();
        let data = [];

        try {
            data = JSON.parse(text);
        } catch {
            document.getElementById("collectionsTableBody").innerHTML =
                `<tr><td colspan="6">Backend returned HTML instead of JSON.</td></tr>`;
            return;
        }

        allCollections = Array.isArray(data) ? data : [];
        renderCollections();
    } catch (error) {
        document.getElementById("collectionsTableBody").innerHTML =
            `<tr><td colspan="6">Error loading collections.</td></tr>`;
    }
}

function renderCollections() {
    const search = document.getElementById("searchCollection").value.trim().toLowerCase();
    const tbody = document.getElementById("collectionsTableBody");
    tbody.innerHTML = "";

    const filtered = allCollections.filter(item => {
        const name = (item.name || "").toLowerCase();
        const url = (item.url || "").toLowerCase();
        return name.includes(search) || url.includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">No collections found.</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="checkbox" class="collection-checkbox" value="${item.id}"></td>
            <td>${item.username || "-"}</td>
            <td>${item.name || "-"}</td>
            <td>${item.method || "-"}</td>
            <td>${item.url || "-"}</td>
            <td>${item.created_at || "-"}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteSelectedCollections() {
    const checked = document.querySelectorAll(".collection-checkbox:checked");
    const ids = Array.from(checked).map(item => Number(item.value));

    if (ids.length === 0) {
        alert("Select at least one collection");
        return;
    }

    if (!confirm("Delete selected collections?")) return;

    try {
        const response = await fetch(`${API_BASE}/admin/collections/delete`, {
            method: "POST",
            headers: authJsonHeaders(),
            body: JSON.stringify({ ids })
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadCollections();
    } catch (error) {
        alert("Error deleting collections");
    }
}

function toggleAllCollections() {
    const main = document.getElementById("selectAllCollections");
    const items = document.querySelectorAll(".collection-checkbox");
    items.forEach(item => {
        item.checked = main.checked;
    });
}

window.addEventListener("DOMContentLoaded", () => {
    loadCollections();
    document.getElementById("deleteSelectedCollectionsBtn").addEventListener("click", deleteSelectedCollections);
    document.getElementById("selectAllCollections").addEventListener("change", toggleAllCollections);
    document.getElementById("searchCollection").addEventListener("input", renderCollections);
});