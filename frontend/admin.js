const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "login.html";
}

if (!loggedInUser.is_admin) {
    alert("Access denied. Admin only.");
    window.location.href = "index.html";
}

document.getElementById("adminInfo").textContent = `Admin: ${loggedInUser.username}`;

function authOnly() {
    return {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
}

function authJson() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: authOnly()
        });
        const users = await response.json();

        const usersTableBody = document.getElementById("usersTableBody");
        if (!usersTableBody) return;
        usersTableBody.innerHTML = "";

        if (!Array.isArray(users) || users.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6">No users found.</td>
                </tr>
            `;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>
                    <span class="${user.is_admin ? 'role-badge admin-role' : 'role-badge user-role'}">
                        ${user.is_admin ? "Admin" : "User"}
                    </span>
                </td>
                <td>${user.created_at}</td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn edit-user-btn">Edit</button>
                        <button class="delete-user-btn">Delete</button>
                    </div>
                </td>
            `;

            tr.querySelector(".edit-user-btn").addEventListener("click", () => editUser(user));
            tr.querySelector(".delete-user-btn").addEventListener("click", () => deleteUser(user.id));

            usersTableBody.appendChild(tr);
        });
    } catch (error) {
        const usersTableBody = document.getElementById("usersTableBody");
        if (usersTableBody) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6">Error loading users: ${error.message}</td>
                </tr>
            `;
        }
    }
}

async function editUser(user) {
    const username = prompt("Enter new username:", user.username);
    if (!username) return;

    const email = prompt("Enter new email:", user.email);
    if (!email) return;

    const isAdmin = confirm("Make this user admin?");

    try {
        const response = await fetch(`${API_BASE}/users/${user.id}`, {
            method: "PUT",
            headers: authJson(),
            body: JSON.stringify({
                username,
                email,
                is_admin: isAdmin
            })
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadUsers();
    } catch (error) {
        alert("Error updating user: " + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: "DELETE",
            headers: authOnly()
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadUsers();
        loadHistory();
        loadDashboardStats();
    } catch (error) {
        alert("Error deleting user: " + error.message);
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/admin/history`, {
            headers: authOnly()
        });
        const data = await response.json();

        const historyOutput = document.getElementById("historyOutput");
        historyOutput.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            historyOutput.innerHTML = "<p>No history found.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "history-item";

            div.innerHTML = `
                <div class="item-top-row">
                    <span class="method-badge method-${(item.method || "GET").toLowerCase()}">${item.method}</span>
                    <span class="status-badge">${item.status_code ?? "-"}</span>
                </div>
                <div><strong>User:</strong> ${item.username || "Unknown"}</div>
                <div class="item-url">${item.url}</div>
                <div class="item-date"><strong>Date:</strong> ${item.created_at}</div>
            `;

            historyOutput.appendChild(div);
        });
    } catch (error) {
        document.getElementById("historyOutput").innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

let methodChartInstance = null;

async function loadDashboardStats() {
    const response = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: authOnly()
    });

    const data = await response.json();

    const statUsers = document.getElementById("statUsers");
    const statRequests = document.getElementById("statRequests");
    const statSuccess = document.getElementById("statSuccess");
    const statRate = document.getElementById("statRate");

    if (statUsers) statUsers.textContent = data.total_users;
    if (statRequests) statRequests.textContent = data.total_requests;
    if (statSuccess) statSuccess.textContent = data.success_requests;
    if (statRate) statRate.textContent = `${data.success_rate}%`;

    const chartCanvas = document.getElementById("methodChart");
    if (!chartCanvas || typeof Chart === "undefined") return;

    const ctx = chartCanvas.getContext("2d");

    if (methodChartInstance) {
        methodChartInstance.destroy();
    }

    methodChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.methods.map(item => item.method),
            datasets: [{
                label: "Requests by Method",
                data: data.methods.map(item => item.count)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: "#e5e7eb"
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#cbd5e1" },
                    grid: { color: "#243041" }
                },
                y: {
                    ticks: { color: "#cbd5e1" },
                    grid: { color: "#243041" }
                }
            }
        }
    });
}

function logoutUser() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

document.getElementById("refreshUsersBtn").addEventListener("click", loadUsers);
document.getElementById("refreshHistoryBtn").addEventListener("click", loadHistory);
document.getElementById("logoutBtn").addEventListener("click", logoutUser);
document.getElementById("goTesterBtn").addEventListener("click", () => {
    window.location.href = "index.html";
});

window.addEventListener("DOMContentLoaded", () => {
    loadUsers();
    loadHistory();
    loadDashboardStats();
});