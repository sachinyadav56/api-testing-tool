const API_BASE = window.location.origin;
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
const token = localStorage.getItem("token");

if (!loggedInUser || !token) {
    window.location.href = "/login.html";
}

if (!loggedInUser.is_admin) {
    window.location.href = "/dashboard.html";
}

let requestsChart;
let plansChart;
let methodsChart;
let purchaseStatusChart;

function authOnlyHeaders() {
    return {
        "Authorization": `Bearer ${token}`
    };
}

function logoutUser() {
    localStorage.clear();
    window.location.href = "/login.html";
}

function getChartTextColor() {
    const theme = document.documentElement.getAttribute("data-theme");
    return theme === "light" ? "#334155" : "#cbd5e1";
}

function getGridColor() {
    const theme = document.documentElement.getAttribute("data-theme");
    return theme === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(148, 163, 184, 0.12)";
}

function destroyCharts() {
    if (requestsChart) requestsChart.destroy();
    if (plansChart) plansChart.destroy();
    if (methodsChart) methodsChart.destroy();
    if (purchaseStatusChart) purchaseStatusChart.destroy();
}

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/stats`, {
            headers: authOnlyHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            console.log(data.error || "Failed to load admin stats");
            return;
        }

        document.getElementById("adminInfo").textContent = `Welcome ${loggedInUser.username}`;
        document.getElementById("statUsers").textContent = data.total_users ?? 0;
        document.getElementById("statRequests").textContent = data.total_requests ?? 0;
        document.getElementById("statRate").textContent = `${data.success_rate ?? 0}%`;
        document.getElementById("statPages").textContent = data.total_pages ?? 0;
    } catch (error) {
        console.log("Admin stats error:", error.message);
    }
}

async function loadChartData() {
    try {
        const [historyRes, usersRes, purchasesRes] = await Promise.all([
            fetch(`${API_BASE}/admin/history`, { headers: authOnlyHeaders() }),
            fetch(`${API_BASE}/users`, { headers: authOnlyHeaders() }),
            fetch(`${API_BASE}/admin/purchases`, { headers: authOnlyHeaders() })
        ]);

        const historyData = await historyRes.json();
        const usersData = await usersRes.json();
        const purchasesData = await purchasesRes.json();

        buildCharts(
            Array.isArray(historyData) ? historyData : [],
            Array.isArray(usersData) ? usersData : [],
            Array.isArray(purchasesData) ? purchasesData : []
        );
    } catch (error) {
        console.log("Chart data error:", error.message);
    }
}

function buildCharts(historyData, usersData, purchasesData) {
    destroyCharts();

    const textColor = getChartTextColor();
    const gridColor = getGridColor();

    const methodCounts = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };
    historyData.forEach(item => {
        const method = item.method || "";
        if (methodCounts[method] !== undefined) {
            methodCounts[method] += 1;
        }
    });

    const planCounts = { Free: 0, Starter: 0, Pro: 0, Enterprise: 0 };
    usersData.forEach(user => {
        const plan = user.active_plan || "Free";
        if (planCounts[plan] !== undefined) {
            planCounts[plan] += 1;
        } else {
            planCounts.Free += 1;
        }
    });

    const purchaseStatusCounts = { pending: 0, paid: 0 };
    purchasesData.forEach(item => {
        const status = (item.status || "pending").toLowerCase();
        if (purchaseStatusCounts[status] !== undefined) {
            purchaseStatusCounts[status] += 1;
        }
    });

    const requestTrend = {};
    historyData.forEach(item => {
        const date = (item.created_at || "").split(" ")[0] || "Unknown";
        requestTrend[date] = (requestTrend[date] || 0) + 1;
    });

    const trendLabels = Object.keys(requestTrend).slice(-7);
    const trendValues = trendLabels.map(label => requestTrend[label]);

    requestsChart = new Chart(document.getElementById("requestsChart"), {
        type: "line",
        data: {
            labels: trendLabels.length ? trendLabels : ["No Data"],
            datasets: [{
                label: "Requests",
                data: trendValues.length ? trendValues : [0],
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.18)",
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        }
    });

    plansChart = new Chart(document.getElementById("plansChart"), {
        type: "doughnut",
        data: {
            labels: Object.keys(planCounts),
            datasets: [{
                data: Object.values(planCounts),
                backgroundColor: ["#94a3b8", "#22c55e", "#3b82f6", "#8b5cf6"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            }
        }
    });

    methodsChart = new Chart(document.getElementById("methodsChart"), {
        type: "bar",
        data: {
            labels: Object.keys(methodCounts),
            datasets: [{
                label: "Requests by Method",
                data: Object.values(methodCounts),
                backgroundColor: ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        }
    });

    purchaseStatusChart = new Chart(document.getElementById("purchaseStatusChart"), {
        type: "pie",
        data: {
            labels: ["Pending", "Paid"],
            datasets: [{
                data: [purchaseStatusCounts.pending, purchaseStatusCounts.paid],
                backgroundColor: ["#f59e0b", "#22c55e"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            }
        }
    });
}

window.addEventListener("DOMContentLoaded", () => {
    loadAdminStats();
    loadChartData();
    document.getElementById("logoutBtn").addEventListener("click", logoutUser);
});