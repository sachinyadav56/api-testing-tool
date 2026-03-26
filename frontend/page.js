const API_BASE = window.location.origin;

function getSlugFromUrl() {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "home";
}

function safeParseContent(content) {
    try {
        return JSON.parse(content);
    } catch {
        return { sections: [] };
    }
}

function renderHero(section) {
    return `
        <section class="premium-hero">
            <div class="premium-hero-inner">
                <span class="premium-badge">${section.badge || "Premium Platform"}</span>
                <h1>${section.heading || ""}</h1>
                <p>${section.subheading || ""}</p>
                <div class="hero-actions">
                    ${section.primaryButton ? `<a class="hero-btn primary" href="${section.primaryButton.link || "#"}">${section.primaryButton.text}</a>` : ""}
                    ${section.secondaryButton ? `<a class="hero-btn secondary" href="${section.secondaryButton.link || "#"}">${section.secondaryButton.text}</a>` : ""}
                </div>
            </div>
        </section>
    `;
}

function renderStats(section) {
    const items = Array.isArray(section.items) ? section.items : [];
    return `
        <section class="premium-section">
            <div class="stats-grid-public">
                ${items.map(item => `
                    <div class="stat-card-public">
                        <h3>${item.value || ""}</h3>
                        <p>${item.label || ""}</p>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function renderFeatures(section) {
    const items = Array.isArray(section.items) ? section.items : [];
    return `
        <section class="premium-section">
            <div class="section-heading">
                <h2>${section.heading || "Features"}</h2>
                <p>${section.subheading || ""}</p>
            </div>
            <div class="feature-grid">
                ${items.map(item => `
                    <div class="feature-card">
                        <div class="feature-icon">◆</div>
                        <h3>${item.title || ""}</h3>
                        <p>${item.description || ""}</p>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function renderPricing(section) {
    const plans = Array.isArray(section.plans) ? section.plans : [];
    return `
        <section class="premium-section">
            <div class="section-heading">
                <h2>${section.heading || "Pricing"}</h2>
                <p>${section.subheading || ""}</p>
            </div>
            <div class="pricing-grid">
                ${plans.map(plan => `
                    <div class="pricing-card">
                        <h3>${plan.name || ""}</h3>
                        <div class="price">${plan.price || ""}</div>
                        <p>${plan.description || ""}</p>
                        <ul>
                            ${(plan.features || []).map(feature => `<li>${feature}</li>`).join("")}
                        </ul>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function renderText(section) {
    return `
        <section class="premium-section">
            <div class="text-block">
                <h2>${section.heading || ""}</h2>
                <p>${section.content || ""}</p>
            </div>
        </section>
    `;
}

function renderSection(section) {
    switch (section.type) {
        case "hero":
            return renderHero(section);
        case "stats":
            return renderStats(section);
        case "features":
            return renderFeatures(section);
        case "pricing":
            return renderPricing(section);
        case "text":
            return renderText(section);
        default:
            return "";
    }
}

async function loadDynamicPage() {
    const slug = getSlugFromUrl();
    const container = document.getElementById("dynamicPageContent");

    try {
        const response = await fetch(`${API_BASE}/api/public/page/${slug}`);
        const data = await response.json();

        if (!response.ok || data.error) {
            container.innerHTML = `<div class="loading-box">Page not found</div>`;
            return;
        }

        document.title = data.title || "API Tool";

        const parsed = safeParseContent(data.content);
        const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

        if (sections.length === 0) {
            container.innerHTML = `<div class="loading-box">No content found</div>`;
            return;
        }

        container.innerHTML = sections.map(renderSection).join("");
    } catch (error) {
        container.innerHTML = `<div class="loading-box">Error loading page</div>`;
    }
}

window.addEventListener("DOMContentLoaded", loadDynamicPage);