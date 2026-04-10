const API_BASE = window.location.origin;
const token = localStorage.getItem("token");
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

if (!token || !loggedInUser) {
    window.location.href = "/login.html";
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
        <button class="toast-close" type="button">&times;</button>
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

async function loadPlans() {
    try {
        const response = await fetch(`${API_BASE}/api/pricing-page`);
        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to load pricing plans", "error");
            return;
        }

        document.getElementById("purchasePageTitle").textContent =
            data.title || "Simple pricing for every workflow";

        document.getElementById("purchasePageDescription").textContent =
            data.description || "Choose a plan that fits your API testing and management needs.";

        const grid = document.getElementById("purchasePlansGrid");
        grid.innerHTML = "";

        const plans = Array.isArray(data.plans) ? data.plans : [];

        if (plans.length === 0) {
            grid.innerHTML = `
                <div class="pricing-card">
                    <h3>No Plans Found</h3>
                    <p>No pricing plans are available right now.</p>
                </div>
            `;
            return;
        }

        plans.forEach(plan => {
            const card = document.createElement("div");
            card.className = "pricing-card";
            card.innerHTML = `
                <h3>${plan.name}</h3>
                <div class="price">₹${plan.price}</div>
                <p>${plan.description || ""}</p>
                <ul>
                    ${(plan.features || []).map(feature => `<li>${feature}</li>`).join("")}
                </ul>
                <p style="margin-top:12px; color: var(--text-soft);">
                    Valid for ${plan.duration_days} days
                </p>
                <div class="button-group" style="margin-top:16px;">
                    <button type="button" class="buy-plan-btn" data-id="${plan.id}">
                        Buy ${plan.name}
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });

        document.querySelectorAll(".buy-plan-btn").forEach(btn => {
            btn.addEventListener("click", () => checkoutPlan(btn.dataset.id));
        });
    } catch (error) {
        showToast("Failed to load pricing plans", "error");
    }
}

async function checkoutPlan(planId) {
    try {
        const checkoutResponse = await fetch(`${API_BASE}/purchase/checkout`, {
            method: "POST",
            headers: authJsonHeaders(),
            body: JSON.stringify({ plan_id: Number(planId) })
        });

        const checkoutData = await checkoutResponse.json();

        if (!checkoutResponse.ok) {
            showToast(checkoutData.error || "Failed to create checkout", "error");
            return;
        }

        const confirmResponse = await fetch(
            `${API_BASE}/purchase/confirm/${checkoutData.purchase_id}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const confirmData = await confirmResponse.json();

        if (!confirmResponse.ok) {
            showToast(confirmData.error || "Failed to confirm purchase", "error");
            return;
        }

        if (loggedInUser) {
            loggedInUser.active_plan = confirmData.active_plan || loggedInUser.active_plan;
            localStorage.setItem("loggedInUser", JSON.stringify(loggedInUser));
        }

        showToast(
            `${confirmData.active_plan} activated. Expiry: ${confirmData.expiry_date}`,
            "success"
        );

        setTimeout(() => {
            window.location.href = "/dashboard.html";
        }, 1000);
    } catch (error) {
        showToast("Purchase failed", "error");
    }
}

window.addEventListener("DOMContentLoaded", loadPlans);