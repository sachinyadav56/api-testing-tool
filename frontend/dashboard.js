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

async function loadDashboardStats() {
    try {
        const [historyRes, collectionsRes, subscriptionRes] = await Promise.all([
            fetch(`${API_BASE}/history`, { headers: authOnlyHeaders() }),
            fetch(`${API_BASE}/collections`, { headers: authOnlyHeaders() }),
            fetch(`${API_BASE}/me/subscription`, { headers: authOnlyHeaders() })
        ]);

        const historyData = await historyRes.json();
        const collectionsData = await collectionsRes.json();
        const subscriptionData = await subscriptionRes.json();

        document.getElementById("dashboardUserInfo").textContent =
            `Welcome ${loggedInUser.username}`;

        document.getElementById("dashboardHistoryCount").textContent =
            Array.isArray(historyData) ? historyData.length : 0;

        document.getElementById("dashboardCollectionsCount").textContent =
            Array.isArray(collectionsData) ? collectionsData.length : 0;

        const currentPlan = subscriptionData.active_plan || "Free";
        document.getElementById("dashboardCurrentPlan").textContent = currentPlan;
        document.getElementById("dashboardPlanStatus").textContent =
            currentPlan === "Free" ? "Inactive" : "Active";
    } catch (error) {
        console.log("Dashboard stats error:", error.message);
    }
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "/login.html";
}

window.addEventListener("DOMContentLoaded", () => {
    loadDashboardStats();
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);
});