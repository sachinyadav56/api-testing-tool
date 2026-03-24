const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token || !loggedInUser.is_admin) {
    window.location.href = "login.html";
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const users = await response.json();
        const tbody = document.getElementById("usersTableBody");
        tbody.innerHTML = "";

        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="6">No users found</td></tr>`;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>
                    <span class="${user.is_admin ? 'role-admin' : 'role-user'}">
                        ${user.is_admin ? "Admin" : "User"}
                    </span>
                </td>
                <td>${user.created_at}</td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn">Edit</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                </td>
            `;

            tr.querySelector(".edit-btn").addEventListener("click", () => editUser(user));
            tr.querySelector(".delete-btn").addEventListener("click", () => deleteUser(user.id));

            tbody.appendChild(tr);
        });
    } catch (error) {
        document.getElementById("usersTableBody").innerHTML =
            `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

async function editUser(user) {
    const username = prompt("Enter username:", user.username);
    if (!username) return;

    const email = prompt("Enter email:", user.email);
    if (!email) return;

    const isAdmin = confirm("Make admin?");

    const response = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            username,
            email,
            is_admin: isAdmin
        })
    });

    const data = await response.json();
    alert(data.message || data.error);
    loadUsers();
}

async function deleteUser(userId) {
    if (!confirm("Delete this user?")) return;

    const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    const data = await response.json();
    alert(data.message || data.error);
    loadUsers();
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "login.html";
}

document.getElementById("refreshUsersBtn").addEventListener("click", loadUsers);
document.getElementById("logoutBtn").addEventListener("click", logoutUser);
window.addEventListener("DOMContentLoaded", loadUsers);