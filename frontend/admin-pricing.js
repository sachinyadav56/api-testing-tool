const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) window.location.href = "/login.html";
if (!loggedInUser.is_admin) window.location.href = "/dashboard.html";

function authJsonHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

async function loadAdminPricing() {
    const response = await fetch(`${API_BASE}/admin/pricing-page`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json();

    document.getElementById("pricingPageTitle").value = data.title || "";
    document.getElementById("pricingPageDescription").value = data.description || "";

    const container = document.getElementById("adminPlansContainer");
    container.innerHTML = "";

    (data.plans || []).forEach(plan => {
        const div = document.createElement("div");
        div.className = "card";
        div.style.marginTop = "16px";
        div.innerHTML = `
            <label>Name</label>
            <input type="text" class="plan-name" value="${plan.name}">

            <label>Price</label>
            <input type="number" class="plan-price" value="${plan.price}">

            <label>Duration Days</label>
            <input type="number" class="plan-duration" value="${plan.duration_days}">

            <label>Description</label>
            <textarea class="plan-description">${plan.description || ""}</textarea>

            <label>Features (comma separated)</label>
            <input type="text" class="plan-features" value="${(plan.features || []).join(", ")}">

            <div class="button-group" style="margin-top:16px;">
                <button class="save-plan-btn" data-id="${plan.id}">Save ${plan.name}</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll(".save-plan-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const card = btn.closest(".card");
            const planId = btn.dataset.id;

            const payload = {
                name: card.querySelector(".plan-name").value.trim(),
                price: Number(card.querySelector(".plan-price").value),
                duration_days: Number(card.querySelector(".plan-duration").value),
                description: card.querySelector(".plan-description").value.trim(),
                features: card.querySelector(".plan-features").value
                    .split(",")
                    .map(v => v.trim())
                    .filter(Boolean)
            };

            const res = await fetch(`${API_BASE}/admin/pricing-plans/${planId}`, {
                method: "PUT",
                headers: authJsonHeaders(),
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            alert(result.message || result.error);
            loadAdminPricing();
        });
    });
}

async function savePricingPage() {
    const payload = {
        title: document.getElementById("pricingPageTitle").value.trim(),
        description: document.getElementById("pricingPageDescription").value.trim()
    };

    const response = await fetch(`${API_BASE}/admin/pricing-page`, {
        method: "PUT",
        headers: authJsonHeaders(),
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    alert(data.message || data.error);
}

window.addEventListener("DOMContentLoaded", () => {
    loadAdminPricing();
    document.getElementById("savePricingPageBtn").addEventListener("click", savePricingPage);
});