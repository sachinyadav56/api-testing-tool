const API_BASE = "http://127.0.0.1:5000";
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

if (!loggedInUser) {
    window.location.href = "login.html";
}

if (!loggedInUser.is_admin) {
    alert("Access denied. Admin only.");
    window.location.href = "index.html";
}

document.getElementById("adminInfo").textContent = `Admin: ${loggedInUser.username}`;

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        const users = await response.json();

        const usersOutput = document.getElementById("usersOutput");
        usersOutput.innerHTML = "";

        if (!users.length) {
            usersOutput.innerHTML = "<p>No users found.</p>";
            return;
        }

        users.forEach(user => {
            const div = document.createElement("div");
            div.className = "collection-item";

            div.innerHTML = `
                <strong>${user.username}</strong><br>
                <strong>Email:</strong> ${user.email}<br>
                <strong>Admin:</strong> ${user.is_admin ? "Yes" : "No"}<br>
                <strong>Created:</strong> ${user.created_at}
                <div class="collection-actions">
                    <button class="load-btn edit-user-btn">Edit</button>
                    <button class="delete-user-btn">Delete</button>
                </div>
            `;

            div.querySelector(".edit-user-btn").addEventListener("click", () => editUser(user));
            div.querySelector(".delete-user-btn").addEventListener("click", () => deleteUser(user.id));

            usersOutput.appendChild(div);
        });
    } catch (error) {
        document.getElementById("usersOutput").innerHTML = `<p>Error: ${error.message}</p>`;
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
            headers: { "Content-Type": "application/json" },
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
            method: "DELETE"
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadUsers();
    } catch (error) {
        alert("Error deleting user: " + error.message);
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/history`);
        const data = await response.json();

        const historyOutput = document.getElementById("historyOutput");
        historyOutput.innerHTML = "";

        if (!data.length) {
            historyOutput.innerHTML = "<p>No history found.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "history-item";

            div.innerHTML = `
                <strong>${item.method}</strong> - ${item.url}<br>
                <strong>Status:</strong> ${item.status_code}<br>
                <strong>Date:</strong> ${item.created_at}
                <div class="collection-actions">
                    <button class="delete-history-btn">Delete</button>
                </div>
            `;

            div.querySelector(".delete-history-btn").addEventListener("click", () => deleteHistory(item.id));

            historyOutput.appendChild(div);
        });
    } catch (error) {
        document.getElementById("historyOutput").innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

async function deleteHistory(historyId) {
    if (!confirm("Delete this history item?")) return;

    try {
        const response = await fetch(`${API_BASE}/history/${historyId}`, {
            method: "DELETE"
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadHistory();
    } catch (error) {
        alert("Error deleting history: " + error.message);
    }
}

async function clearAllHistory() {
    if (!confirm("Clear all history?")) return;

    try {
        const response = await fetch(`${API_BASE}/history/clear`, {
            method: "DELETE"
        });

        const data = await response.json();
        alert(data.message || data.error);
        loadHistory();
    } catch (error) {
        alert("Error clearing history: " + error.message);
    }
}

function logoutUser() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
}

document.getElementById("refreshUsersBtn").addEventListener("click", loadUsers);
document.getElementById("clearHistoryBtn").addEventListener("click", clearAllHistory);
document.getElementById("logoutBtn").addEventListener("click", logoutUser);
document.getElementById("goTesterBtn").addEventListener("click", () => {
    window.location.href = "index.html";
});

window.addEventListener("DOMContentLoaded", () => {
    loadUsers();
    loadHistory();
});