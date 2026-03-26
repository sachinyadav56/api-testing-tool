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

function showCmsToast(message, type = "success") {
    let box = document.getElementById("cmsToast");

    if (!box) {
        box = document.createElement("div");
        box.id = "cmsToast";
        box.style.position = "fixed";
        box.style.top = "20px";
        box.style.right = "20px";
        box.style.zIndex = "9999";
        box.style.padding = "12px 16px";
        box.style.borderRadius = "12px";
        box.style.color = "#fff";
        box.style.fontWeight = "600";
        document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.background = type === "success" ? "#16a34a" : "#dc2626";
    box.style.display = "block";

    setTimeout(() => {
        box.style.display = "none";
    }, 3000);
}

function safeGetEditorData() {
    const text = document.getElementById("pageContent").value.trim();
    if (!text) return { sections: [] };

    const parsed = JSON.parse(text);
    if (!parsed.sections || !Array.isArray(parsed.sections)) {
        return { sections: [] };
    }
    return parsed;
}

function setEditorData(data) {
    document.getElementById("pageContent").value = JSON.stringify(data, null, 2);
}

function resetForm() {
    document.getElementById("pageId").value = "";
    document.getElementById("pageTitle").value = "";
    document.getElementById("pageSlug").value = "";
    document.getElementById("pageStatus").value = "draft";
    setEditorData({ sections: [] });
}

function appendSection(section) {
    try {
        const data = safeGetEditorData();
        data.sections.push(section);
        setEditorData(data);
        showCmsToast("Section inserted", "success");
    } catch (error) {
        showCmsToast("Invalid JSON in editor", "error");
    }
}

function insertHeroSection() {
    appendSection({
        type: "hero",
        badge: "Premium API Platform",
        heading: "Build, test and scale APIs faster",
        subheading: "A premium API workspace inspired by modern cloud tools.",
        primaryButton: { text: "Get Started", link: "/login.html" },
        secondaryButton: { text: "Explore Features", link: "/page/home" }
    });
}

function insertStatsSection() {
    appendSection({
        type: "stats",
        items: [
            { value: "99.9%", label: "Uptime" },
            { value: "10K+", label: "Requests Tested" },
            { value: "500+", label: "Collections" },
            { value: "24/7", label: "Monitoring" }
        ]
    });
}

function insertFeaturesSection() {
    appendSection({
        type: "features",
        heading: "Everything in one platform",
        subheading: "Built for developers and teams",
        items: [
            {
                title: "Smart API Testing",
                description: "Test endpoints quickly with request builder and history."
            },
            {
                title: "Dynamic CMS",
                description: "Publish premium-looking pages directly from admin panel."
            },
            {
                title: "Admin Control",
                description: "Manage users, collections and logs easily."
            }
        ]
    });
}

function formatJson() {
    try {
        const data = safeGetEditorData();
        setEditorData(data);
        showCmsToast("JSON formatted", "success");
    } catch (error) {
        showCmsToast("Invalid JSON", "error");
    }
}

async function loadPages() {
    try {
        const response = await fetch(`${API_BASE}/cms/pages`, {
            headers: { "Authorization": `Bearer ${token}` }
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
    document.getElementById("pageContent").value = page.content || '{\n  "sections": []\n}';
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function savePage() {
    const pageId = document.getElementById("pageId").value;
    const title = document.getElementById("pageTitle").value.trim();
    const slug = document.getElementById("pageSlug").value.trim().toLowerCase();
    const status = document.getElementById("pageStatus").value;
    const content = document.getElementById("pageContent").value.trim();

    if (!title || !slug || !content) {
        showCmsToast("Please fill all fields", "error");
        return;
    }

    try {
        JSON.parse(content);
    } catch (error) {
        showCmsToast("Content JSON is invalid", "error");
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

        if (response.ok) {
            showCmsToast(data.message || "Page saved successfully", "success");
            resetForm();
            loadPages();
        } else {
            showCmsToast(data.error || "Failed to save page", "error");
        }
    } catch (error) {
        showCmsToast("Error saving page: " + error.message, "error");
    }
}

async function deletePage(pageId) {
    if (!confirm("Delete this page?")) return;

    try {
        const response = await fetch(`${API_BASE}/cms/pages/${pageId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await response.json();
        showCmsToast(data.message || data.error, response.ok ? "success" : "error");
        loadPages();
    } catch (error) {
        showCmsToast("Error deleting page: " + error.message, "error");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    resetForm();
    loadPages();

    document.getElementById("savePageBtn").addEventListener("click", savePage);
    document.getElementById("resetPageBtn").addEventListener("click", resetForm);
    document.getElementById("insertHeroBtn").addEventListener("click", insertHeroSection);
    document.getElementById("insertStatsBtn").addEventListener("click", insertStatsSection);
    document.getElementById("insertFeaturesBtn").addEventListener("click", insertFeaturesSection);
    document.getElementById("formatJsonBtn").addEventListener("click", formatJson);
});