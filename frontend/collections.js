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

async function loadCollections() {
    try {
        const response = await fetch(`${API_BASE}/admin/collections`, {
            headers: authOnlyHeaders()
        });

        const text = await response.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch {
            document.getElementById("collectionsTableBody").innerHTML =
                `<tr><td colspan="5">Backend returned HTML instead of JSON. Check /admin/collections route.</td></tr>`;
            return;
        }

        const tbody = document.getElementById("collectionsTableBody");
        tbody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">No collections found.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><input type="checkbox" class="collection-checkbox" value="${item.id}"></td>
                <td>${item.username || "-"}</td>
                <td>${item.method || "-"}</td>
                <td>${item.url || "-"}</td>
                <td>${item.created_at || "-"}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        document.getElementById("collectionsTableBody").innerHTML =
            `<tr><td colspan="5">Error loading collections: ${error.message}</td></tr>`;
    }
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
        alert("Error deleting collections: " + error.message);
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
});