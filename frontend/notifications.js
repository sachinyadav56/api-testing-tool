const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) window.location.href = "/login.html";

document.addEventListener("DOMContentLoaded", () => {
    const backLink = document.getElementById("backLink");
    backLink.href = loggedInUser.is_admin ? "/admin.html" : "/dashboard.html";
    loadNotifications();
});

async function loadNotifications() {
    const res = await fetch(`${API_BASE}/notifications`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await res.json();
    const list = document.getElementById("notificationsList");
    list.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = `<p>No notifications found.</p>`;
        return;
    }

    data.forEach(item => {
        const div = document.createElement("div");
        div.className = "overview-item";
        div.style.marginBottom = "12px";
        div.innerHTML = `
            <div>
                <strong style="font-size:18px;">${item.title}</strong>
                <p style="margin:6px 0 0;">${item.message}</p>
                <small style="color:var(--text-soft);">${item.created_at || ""}</small>
            </div>
            <div>
                ${item.is_read ? '<span class="role-user">Read</span>' : `<button class="mark-read-btn" data-id="${item.id}">Mark Read</button>`}
            </div>
        `;
        list.appendChild(div);
    });

    document.querySelectorAll(".mark-read-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            await fetch(`${API_BASE}/notifications/${id}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            loadNotifications();
        });
    });
}