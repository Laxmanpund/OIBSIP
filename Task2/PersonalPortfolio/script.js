const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const backToTop = document.getElementById("backToTop");
const year = document.getElementById("year");

// Automatically update copyright year
if (year) {
  year.textContent = new Date().getFullYear();
}

// Mobile navigation menu
if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");

    const isOpen = navLinks.classList.contains("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close menu after clicking a link
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Show back-to-top button after scrolling
function updateBackToTop() {
  if (backToTop) {
    backToTop.classList.toggle("visible", window.scrollY > 400);
  }
}

window.addEventListener("scroll", updateBackToTop, {
  passive: true
});

updateBackToTop();

// Scroll smoothly to the top
if (backToTop) {
  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}