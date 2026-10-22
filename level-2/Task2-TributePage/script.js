const navLinks = document.querySelectorAll(".navbar nav a");

navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        navLinks.forEach((item) => {
            item.classList.remove("active");
        });

        link.classList.add("active");
    });
});

// Reveal sections when they enter the viewport
const sections = document.querySelectorAll(".section");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries, observerInstance) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observerInstance.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.12
        }
    );

    sections.forEach((section) => {
        section.classList.add("reveal");
        observer.observe(section);
    });
} else {
    sections.forEach((section) => {
        section.classList.add("visible");
    });
}

// Update the browser tab title
document.title = "Dr. APJ Abdul Kalam | A Tribute";