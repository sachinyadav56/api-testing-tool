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

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/stats`, {
            headers: authOnlyHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(data.error || "Failed to load admin stats");
            return;
        }

        document.getElementById("adminInfo").textContent = `Welcome ${loggedInUser.username}`;
        document.getElementById("statUsers").textContent = data.total_users ?? 0;
        document.getElementById("statRequests").textContent = data.total_requests ?? 0;
        document.getElementById("statRate").textContent = `${data.success_rate ?? 0}%`;
        document.getElementById("statPages").textContent = data.total_pages ?? 0;
    } catch (error) {
        console.log("Admin stats error:", error.message);
    }
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "/login.html";
}

window.addEventListener("DOMContentLoaded", () => {
    loadAdminStats();
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);
});