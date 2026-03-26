const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "/login.html";
}

function authJsonHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

async function confirmPayment() {
    const purchaseId = getQueryParam("purchase_id");

    if (!purchaseId) {
        alert("Purchase not found");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/purchase/confirm/${purchaseId}`, {
            method: "POST",
            headers: authJsonHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Payment failed");
            return;
        }

        alert("Payment done. Plan active: " + data.active_plan);
        window.location.href = "/dashboard.html";
    } catch (error) {
        alert("Payment failed");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const plan = getQueryParam("plan") || "Plan";
    const amount = getQueryParam("amount") || "";

    document.getElementById("paymentPlanName").textContent = plan;
    document.getElementById("paymentAmount").textContent = amount;
    document.getElementById("confirmPaymentBtn").addEventListener("click", confirmPayment);
});