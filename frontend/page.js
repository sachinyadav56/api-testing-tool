async function loadDynamicPage() {
    const container = document.getElementById("dynamicPageContent");
    const slug = window.location.pathname.split("/").pop();

    try {
        const response = await fetch(`/api/public/page/${slug}`);
        const data = await response.json();

        if (!response.ok) {
            container.innerHTML = `<div class="loading-box">${data.error || "No content found"}</div>`;
            return;
        }

        let content = {};
        try {
            content = JSON.parse(data.content || "{}");
        } catch (error) {
            container.innerHTML = `<div class="loading-box">Invalid page content</div>`;
            return;
        }

        const hero = content.hero || {};
        const cards = Array.isArray(content.cards) ? content.cards : [];

        container.innerHTML = `
            <section class="premium-hero">
                <div class="hero-badge">${hero.badge || "API Tool"}</div>
                <h1>${hero.title || data.title || "Welcome"}</h1>
                <p>${hero.subtitle || ""}</p>
                ${
                    hero.buttonText && hero.buttonLink
                    ? `<a href="${hero.buttonLink}" class="hero-btn">${hero.buttonText}</a>`
                    : ""
                }
            </section>

            ${
                cards.length
                ? `
                <section class="premium-card-grid">
                    ${cards.map(card => `
                        <div class="premium-info-card">
                            <h3>${card.title || ""}</h3>
                            <p>${card.description || ""}</p>
                        </div>
                    `).join("")}
                </section>
                `
                : ""
            }
        `;

        document.title = data.title || "API Tool";
    } catch (error) {
        container.innerHTML = `<div class="loading-box">Failed to load page</div>`;
    }
}

document.addEventListener("DOMContentLoaded", loadDynamicPage);