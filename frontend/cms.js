const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token || !loggedInUser.is_admin) {
    window.location.href = "login.html";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

async function loadPages() {
    try {
        const response = await fetch(`${API_BASE}/cms/pages`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        const tbody = document.getElementById("pagesTableBody");
        tbody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">No pages found.</td></tr>`;
            return;
        }

        data.forEach(page => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${page.id}</td>
                <td>${page.title}</td>
                <td>${page.slug}</td>
                <td>${page.status}</td>
                <td>${page.updated_at || "-"}</td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </td>
            `;

            tr.querySelector(".edit-btn").addEventListener("click", () => fillForm(page));
            tr.querySelector(".delete-btn").addEventListener("click", () => deletePage(page.id));

            tbody.appendChild(tr);
        });
    } catch (error) {
        document.getElementById("pagesTableBody").innerHTML =
            `<tr><td colspan="6">Error loading pages: ${error.message}</td></tr>`;
    }
}

function fillForm(page) {
    document.getElementById("pageId").value = page.id;
    document.getElementById("pageTitle").value = page.title;
    document.getElementById("pageSlug").value = page.slug;
    document.getElementById("pageStatus").value = page.status;
    document.getElementById("pageContent").value = page.content;
}

function resetForm() {
    document.getElementById("pageId").value = "";
    document.getElementById("pageTitle").value = "";
    document.getElementById("pageSlug").value = "";
    document.getElementById("pageStatus").value = "draft";
    document.getElementById("pageContent").value = "";
}

async function savePage() {
    const pageId = document.getElementById("pageId").value;
    const title = document.getElementById("pageTitle").value.trim();
    const slug = document.getElementById("pageSlug").value.trim().toLowerCase();
    const status = document.getElementById("pageStatus").value;
    const content = document.getElementById("pageContent").value.trim();

    if (!title || !slug || !content) {
        alert("Please fill all fields");
        return;
    }

    const payload = { title, slug, status, content };
    const url = pageId ? `${API_BASE}/cms/pages/${pageId}` : `${API_BASE}/cms/pages`;
    const method = pageId ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        alert(data.message || data.error);

        if (response.ok) {
            resetForm();
            loadPages();
        }
    } catch (error) {
        alert("Error saving page: " + error.message);
    }
}

async function deletePage(pageId) {
    if (!confirm("Delete this page?")) return;

    try {
        const response = await fetch(`${API_BASE}/cms/pages/${pageId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadPages();
    } catch (error) {
        alert("Error deleting page: " + error.message);
    }
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "login.html";
}

document.getElementById("savePageBtn").addEventListener("click", savePage);
document.getElementById("resetPageBtn").addEventListener("click", resetForm);
document.getElementById("refreshPagesBtn").addEventListener("click", loadPages);
document.getElementById("logoutBtn").addEventListener("click", logoutUser);
window.addEventListener("DOMContentLoaded", loadPages);