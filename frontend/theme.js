document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("theme") || "light";

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    } else {
        document.body.classList.remove("dark-mode");
    }

    updateThemeButton();

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("dark-mode");
            const isDark = document.body.classList.contains("dark-mode");
            localStorage.setItem("theme", isDark ? "dark" : "light");
            updateThemeButton();
        });
    }

    function updateThemeButton() {
        if (!themeToggle) return;
        if (document.body.classList.contains("dark-mode")) {
            themeToggle.textContent = "☀ Light";
        } else {
            themeToggle.textContent = "🌙 Dark";
        }
    }
});