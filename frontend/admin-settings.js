const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "/login.html";
}

if (!loggedInUser.is_admin) {
    window.location.href = "/dashboard.html";
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

async function loadAdminProfile() {
    try {
        const response = await fetch(`${API_BASE}/me/subscription`, {
            headers: authOnlyHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to load profile", "error");
            return;
        }

        document.getElementById("adminSettingsUsername").textContent = data.username || "-";
        document.getElementById("adminSettingsEmail").textContent = data.email || "-";

        document.getElementById("adminUsername").value = data.username || "";
        document.getElementById("adminEmail").value = data.email || "";
    } catch (error) {
        showToast("Failed to load profile", "error");
    }
}

async function saveAdminProfile() {
    const username = document.getElementById("adminUsername").value.trim();
    const email = document.getElementById("adminEmail").value.trim();

    if (!username || !email) {
        showToast("Please fill all fields", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/me/profile`, {
            method: "PUT",
            headers: authJsonHeaders(),
            body: JSON.stringify({ username, email })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to update profile", "error");
            return;
        }

        localStorage.setItem("loggedInUser", JSON.stringify({
            ...loggedInUser,
            username,
            email
        }));

        showToast(data.message || "Profile updated successfully", "success");
        loadAdminProfile();
    } catch (error) {
        showToast("Failed to update profile", "error");
    }
}

async function changeAdminPassword() {
    const currentPassword = document.getElementById("adminCurrentPassword").value.trim();
    const newPassword = document.getElementById("adminNewPassword").value.trim();

    if (!currentPassword || !newPassword) {
        showToast("Please fill all password fields", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/me/password`, {
            method: "PUT",
            headers: authJsonHeaders(),
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to change password", "error");
            return;
        }

        document.getElementById("adminCurrentPassword").value = "";
        document.getElementById("adminNewPassword").value = "";

        showToast(data.message || "Password changed successfully", "success");
    } catch (error) {
        showToast("Failed to change password", "error");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    loadAdminProfile();
    document.getElementById("saveAdminProfileBtn").addEventListener("click", saveAdminProfile);
    document.getElementById("changeAdminPasswordBtn").addEventListener("click", changeAdminPassword);
});
