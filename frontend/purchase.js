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

function authJsonHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function ensureToastContainer() {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = "success") {
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : "✕"}</span>
        <span class="toast-text">${message}</span>
        <button class="toast-close">&times;</button>
    `;

    toast.querySelector(".toast-close").addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

async function createCheckout(planName, amount) {
    try {
        const response = await fetch(`${API_BASE}/purchase/checkout`, {
            method: "POST",
            headers: authJsonHeaders(),
            body: JSON.stringify({
                plan_name: planName,
                amount: amount
            })
        });

        const text = await response.text();
        let data = {};
        try {
            data = JSON.parse(text);
        } catch {
            showToast("Backend route missing for checkout", "error");
            return;
        }

        if (!response.ok) {
            showToast(data.error || "Checkout failed", "error");
            return;
        }

        window.location.href = `/payment.html?purchase_id=${data.purchase_id}&plan=${encodeURIComponent(planName)}&amount=${encodeURIComponent(amount)}`;
    } catch (error) {
        showToast("Checkout failed", "error");
    }
}

async function loadMyPurchases() {
    try {
        const response = await fetch(`${API_BASE}/my/purchases`, {
            headers: authOnlyHeaders()
        });

        const data = await response.json();
        const container = document.getElementById("myPurchasesOutput");
        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = "<p>No purchases yet.</p>";
            return;
        }

        data.forEach(item => {
            const div = document.createElement("div");
            div.className = "collection-item";
            div.innerHTML = `
                <strong>${item.plan_name}</strong> - ${item.amount}<br>
                Status: ${item.status}<br>
                <small>${item.created_at}</small>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        document.getElementById("myPurchasesOutput").innerHTML = "<p>Error loading purchases.</p>";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".buy-plan-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            createCheckout(btn.dataset.plan, btn.dataset.amount);
        });
    });

    loadMyPurchases();
});