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

async function loadQueries() {
    try {
        const response = await fetch(`${API_BASE}/admin/queries`, {
            headers: authOnlyHeaders()
        });

        const data = await response.json();
        const tbody = document.getElementById("queriesTableBody");
        tbody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">No queries found.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.name || "-"}</td>
                <td>${item.email || "-"}</td>
                <td>${item.subject || "-"}</td>
                <td>${item.message || "-"}</td>
                <td>${item.status || "-"}</td>
                <td>${item.created_at || "-"}</td>
                <td>
                    ${item.status === "solved"
                        ? `<span class="role-admin">Solved</span>`
                        : `<button class="edit-btn solve-btn" data-id="${item.id}">Mark Solved</button>`
                    }
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll(".solve-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const queryId = btn.dataset.id;

                try {
                    const res = await fetch(`${API_BASE}/admin/queries/${queryId}/solve`, {
                        method: "PUT",
                        headers: authOnlyHeaders()
                    });

                    const result = await res.json();
                    alert(result.message || result.error);
                    loadQueries();
                } catch (error) {
                    alert("Failed to update query");
                }
            });
        });
    } catch (error) {
        document.getElementById("queriesTableBody").innerHTML =
            `<tr><td colspan="7">Error loading queries.</td></tr>`;
    }
}

window.addEventListener("DOMContentLoaded", loadQueries);