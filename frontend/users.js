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

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: authOnlyHeaders()
        });

        const text = await response.text();
        let data = [];
        try {
            data = JSON.parse(text);
        } catch {
            document.getElementById("usersTableBody").innerHTML =
                `<tr><td colspan="7">Backend returned HTML instead of JSON.</td></tr>`;
            return;
        }

        const tbody = document.getElementById("usersTableBody");
        tbody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">No users found.</td></tr>`;
            return;
        }

        data.forEach(user => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.is_admin ? '<span class="role-admin">Admin</span>' : '<span class="role-user">User</span>'}</td>
                <td>${user.active_plan || "Free"}</td>
                <td>${user.created_at || "-"}</td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </td>
            `;

            tr.querySelector(".edit-btn").addEventListener("click", async () => {
                const username = prompt("Username:", user.username);
                if (!username) return;

                const email = prompt("Email:", user.email);
                if (!email) return;

                const isAdmin = confirm("Make admin? OK = Yes, Cancel = No");

                const res = await fetch(`${API_BASE}/users/${user.id}`, {
                    method: "PUT",
                    headers: authJsonHeaders(),
                    body: JSON.stringify({
                        username,
                        email,
                        is_admin: isAdmin
                    })
                });

                const result = await res.json();
                alert(result.message || result.error);
                loadUsers();
            });

            tr.querySelector(".delete-btn").addEventListener("click", async () => {
                if (!confirm("Delete this user?")) return;

                const res = await fetch(`${API_BASE}/users/${user.id}`, {
                    method: "DELETE",
                    headers: authOnlyHeaders()
                });

                const result = await res.json();
                alert(result.message || result.error);
                loadUsers();
            });

            tbody.appendChild(tr);
        });
    } catch (error) {
        document.getElementById("usersTableBody").innerHTML =
            `<tr><td colspan="7">Error loading users.</td></tr>`;
    }
}

window.addEventListener("DOMContentLoaded", loadUsers);