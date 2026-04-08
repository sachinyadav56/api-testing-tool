const API_BASE = window.location.origin;

async function loadPricingPage() {
    try {
        const response = await fetch(`${API_BASE}/api/pricing-page`);
        const data = await response.json();

        if (!response.ok) return;

        document.getElementById("pricingTitle").textContent =
            data.title || "Simple pricing for every workflow";

        document.getElementById("pricingDescription").textContent =
            data.description || "Choose a plan that fits your API testing and management needs.";

        const pricingCards = document.getElementById("pricingCards");

        if (Array.isArray(data.plans) && data.plans.length > 0) {
            pricingCards.innerHTML = "";

            data.plans.forEach(plan => {
                const card = document.createElement("div");
                card.className = "pricing-card";
                card.innerHTML = `
                    <h3>${plan.name}</h3>
                    <div class="price">₹${plan.price}</div>
                    <p>${plan.description}</p>
                    <ul>
                        ${(plan.features || []).map(item => `<li>${item}</li>`).join("")}
                    </ul>
                `;
                pricingCards.appendChild(card);
            });
        }
    } catch (error) {
        console.log("Failed to load pricing page");
    }
}

window.addEventListener("DOMContentLoaded", loadPricingPage);
