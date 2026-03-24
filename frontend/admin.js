const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token || !loggedInUser.is_admin) {
    window.location.href = "login.html";
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/stats`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        document.getElementById("statUsers").textContent = data.total_users || 0;
        document.getElementById("statRequests").textContent = data.total_requests || 0;
        document.getElementById("statSuccess").textContent = data.success_requests || 0;
        document.getElementById("statRate").textContent = `${data.success_rate || 0}%`;
        document.getElementById("statPages").textContent = data.total_pages || 0;
        document.getElementById("statCollections").textContent = data.total_collections || 0;
        document.getElementById("adminInfo").textContent = `Welcome ${loggedInUser.username}`;
    } catch (err) {
        console.log(err);
    }
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "login.html";
}

document.getElementById("logoutBtn").addEventListener("click", logoutUser);
window.addEventListener("DOMContentLoaded", loadStats);