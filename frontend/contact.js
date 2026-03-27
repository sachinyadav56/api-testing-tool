const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

function authJsonHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
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
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : "✕"}</span>
        <span class="toast-text">${message}</span>
        <button class="toast-close">&times;</button>
    `;

    toast.querySelector(".toast-close").addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

function preloadUserData() {
    if (!loggedInUser) return;
    const nameInput = document.getElementById("queryName");
    const emailInput = document.getElementById("queryEmail");

    if (nameInput) nameInput.value = loggedInUser.username || "";
    if (emailInput) emailInput.value = loggedInUser.email || "";
}

async function sendQuery() {
    const name = document.getElementById("queryName").value.trim();
    const email = document.getElementById("queryEmail").value.trim();
    const subject = document.getElementById("querySubject").value.trim();
    const message = document.getElementById("queryMessage").value.trim();

    if (!name || !email || !subject || !message) {
        showToast("Please fill all fields", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/support/query`, {
            method: "POST",
            headers: authJsonHeaders(),
            body: JSON.stringify({
                name,
                email,
                subject,
                message
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to send query", "error");
            return;
        }

        showToast(data.message || "Query sent successfully", "success");
        document.getElementById("querySubject").value = "";
        document.getElementById("queryMessage").value = "";
    } catch (error) {
        showToast("Failed to send query", "error");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    preloadUserData();
    document.getElementById("sendQueryBtn").addEventListener("click", sendQuery);
});