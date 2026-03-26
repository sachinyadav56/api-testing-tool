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

function logoutUser() {
    localStorage.clear();
    window.location.href = "/login.html";
}

function normalizeAmount(amount) {
    if (!amount) return 0;
    const cleaned = String(amount).replace(/[^0-9.]/g, "");
    return Number(cleaned) || 0;
}

async function loadPurchases() {
    try {
        const response = await fetch(`${API_BASE}/admin/purchases`, {
            headers: authOnlyHeaders()
        });

        const text = await response.text();
        let data = [];
        try {
            data = JSON.parse(text);
        } catch {
            document.getElementById("purchasesTableBody").innerHTML =
                `<tr><td colspan="7">Backend returned HTML instead of JSON.</td></tr>`;
            return;
        }

        const tbody = document.getElementById("purchasesTableBody");
        tbody.innerHTML = "";

        let starter = 0;
        let pro = 0;
        let enterprise = 0;
        let revenue = 0;

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">No purchases found.</td></tr>`;
            document.getElementById("starterCount").textContent = "0";
            document.getElementById("proCount").textContent = "0";
            document.getElementById("enterpriseCount").textContent = "0";
            document.getElementById("revenueCount").textContent = "$0";
            return;
        }

        data.forEach(item => {
            if (item.status === "paid") {
                if (item.plan_name === "Starter") starter += 1;
                if (item.plan_name === "Pro") pro += 1;
                if (item.plan_name === "Enterprise") enterprise += 1;
                revenue += normalizeAmount(item.amount);
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.username || "-"}</td>
                <td>${item.email || "-"}</td>
                <td>${item.plan_name || "-"}</td>
                <td>${item.amount || "-"}</td>
                <td>${item.status || "-"}</td>
                <td>${item.created_at || "-"}</td>
                <td>${item.active_plan || "-"}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById("starterCount").textContent = String(starter);
        document.getElementById("proCount").textContent = String(pro);
        document.getElementById("enterpriseCount").textContent = String(enterprise);
        document.getElementById("revenueCount").textContent = `$${revenue}`;
    } catch (error) {
        document.getElementById("purchasesTableBody").innerHTML =
            `<tr><td colspan="7">Error loading purchases.</td></tr>`;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);
    loadPurchases();
});