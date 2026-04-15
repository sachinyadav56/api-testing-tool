<script>
async function loadUnreadNotificationCount() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${window.location.origin}/notifications/unread-count`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        const badge = document.getElementById("notificationBadge");
        if (!badge) return;

        const count = Number(data.unread_count || 0);
        if (count > 0) {
            badge.style.display = "inline-flex";
            badge.textContent = count > 99 ? "99+" : count;
        } else {
            badge.style.display = "none";
        }
    } catch (error) {
        console.log("Failed to load unread notification count");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadUnreadNotificationCount();

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            localStorage.removeItem("loggedInUser");
            window.location.href = "/admin-login.html";
        });
    }
});
</script>