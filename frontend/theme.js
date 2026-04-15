document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("theme") || "dark";

    document.body.classList.remove("light-mode", "dark-mode");
    document.documentElement.removeAttribute("data-theme");

    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
        document.documentElement.setAttribute("data-theme", "light");
    } else {
        document.body.classList.add("dark-mode");
        document.documentElement.setAttribute("data-theme", "dark");
    }

    updateThemeButton();

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const isDark = document.body.classList.contains("dark-mode");

            document.body.classList.remove("light-mode", "dark-mode");

            if (isDark) {
                document.body.classList.add("light-mode");
                document.documentElement.setAttribute("data-theme", "light");
                localStorage.setItem("theme", "light");
            } else {
                document.body.classList.add("dark-mode");
                document.documentElement.setAttribute("data-theme", "dark");
                localStorage.setItem("theme", "dark");
            }

            updateThemeButton();
        });
    }

    function updateThemeButton() {
        if (!themeToggle) return;
        themeToggle.textContent = document.body.classList.contains("dark-mode")
            ? "☀ Light"
            : "🌙 Dark";
    }
});