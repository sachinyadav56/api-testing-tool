const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "/login.html";
}

if (loggedInUser.is_admin) {
    window.location.href = "/admin.html";
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

async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE}/me/subscription`, {
            headers: authOnlyHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to load profile", "error");
            return;
        }

        document.getElementById("profileUsername").textContent = data.username || "-";
        document.getElementById("profileEmail").textContent = data.email || "-";
        document.getElementById("profilePlan").textContent = data.active_plan || "Free";
        document.getElementById("profileRole").textContent = "User";

        document.getElementById("settingsUsername").value = data.username || "";
        document.getElementById("settingsEmail").value = data.email || "";
    } catch (error) {
        showToast("Failed to load profile", "error");
    }
}

async function saveProfile() {
    const username = document.getElementById("settingsUsername").value.trim();
    const email = document.getElementById("settingsEmail").value.trim();

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

        const updatedUser = {
            ...loggedInUser,
            username,
            email
        };
        localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));

        showToast(data.message || "Profile updated", "success");
        loadProfile();
    } catch (error) {
        showToast("Failed to update profile", "error");
    }
}

async function changePassword() {
    const currentPassword = document.getElementById("currentPassword").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();

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

        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        showToast(data.message || "Password changed", "success");
    } catch (error) {
        showToast("Failed to change password", "error");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);
    document.getElementById("changePasswordBtn").addEventListener("click", changePassword);
});