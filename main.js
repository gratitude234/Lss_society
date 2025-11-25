// Main JS for Law Students’ Society – JABU site

document.addEventListener("DOMContentLoaded", function () {
  /* ==========
     Nav Toggle
     ========== */
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("nav-open");
      navToggle.classList.toggle("is-active");
    });

    // Close nav after clicking a link (mobile)
    navLinks.addEventListener("click", (e) => {
      if (e.target.tagName.toLowerCase() === "a") {
        navLinks.classList.remove("nav-open");
        navToggle.classList.remove("is-active");
      }
    });
  }

  /* ==========
     Dynamic Year
     ========== */
  const yearSpans = document.querySelectorAll(".current-year");
  const now = new Date().getFullYear();
  yearSpans.forEach((span) => (span.textContent = now));

  /* ==========
     Home Slider (Featured Events)
     ========== */
  const slides = document.querySelectorAll(".event-slide");
  const prevBtn = document.querySelector(".slider-btn.prev");
  const nextBtn = document.querySelector(".slider-btn.next");

  if (slides.length && prevBtn && nextBtn) {
    let currentIndex = 0;

    function showSlide(index) {
      slides.forEach((slide, i) => {
        slide.classList.toggle("active", i === index);
      });
    }

    function nextSlide() {
      currentIndex = (currentIndex + 1) % slides.length;
      showSlide(currentIndex);
    }

    function prevSlide() {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      showSlide(currentIndex);
    }

    nextBtn.addEventListener("click", nextSlide);
    prevBtn.addEventListener("click", prevSlide);

    // Auto-advance every 8 seconds
    setInterval(nextSlide, 8000);
  }

  /* ==========
     Events Filter
     ========== */
  const filterButtons = document.querySelectorAll(".event-filter");
  const eventCards = document.querySelectorAll(".event-card");

  if (filterButtons.length && eventCards.length) {
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.getAttribute("data-filter");

        filterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        eventCards.forEach((card) => {
          const category = card.getAttribute("data-category");
          if (filter === "all" || filter === category) {
            card.style.display = "";
          } else {
            card.style.display = "none";
          }
        });
      });
    });
  }

  /* ==========
     Blog Search & Category Filter
     ========== */
  const blogSearch = document.querySelector("#blogSearch");
  const blogPosts = document.querySelectorAll(".blog-post");
  const blogCategoryLinks = document.querySelectorAll(".blog-category");

  function filterBlogPosts() {
    if (!blogPosts.length) return;

    const term = blogSearch ? blogSearch.value.toLowerCase() : "";
    const activeCatLink = document.querySelector(".blog-category.active");
    const activeCategory = activeCatLink
      ? activeCatLink.getAttribute("data-category")
      : "all";

    blogPosts.forEach((post) => {
      const title = post
        .querySelector(".blog-post-title")
        .textContent.toLowerCase();
      const postCategory = post.getAttribute("data-category");

      const matchesTerm = title.includes(term);
      const matchesCat =
        activeCategory === "all" || activeCategory === postCategory;

      post.style.display = matchesTerm && matchesCat ? "" : "none";
    });
  }

  if (blogSearch && blogPosts.length) {
    blogSearch.addEventListener("input", filterBlogPosts);
  }

  if (blogCategoryLinks.length && blogPosts.length) {
    blogCategoryLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        blogCategoryLinks.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        filterBlogPosts();
      });
    });
  }

  /* ==========
     FAQ Accordion
     ========== */
  const faqQuestions = document.querySelectorAll(".faq-question");

  if (faqQuestions.length) {
    faqQuestions.forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".faq-item");
        const isOpen = item.classList.contains("open");

        // Close others
        document
          .querySelectorAll(".faq-item.open")
          .forEach((openItem) => openItem.classList.remove("open"));

        if (!isOpen) {
          item.classList.add("open");
        }
      });
    });
  }

  /* ==========
     Contact Form Validation
     ========== */
  const contactForm = document.querySelector("#contactForm");
  const formMessages = document.querySelector("#formMessages");

  if (contactForm && formMessages) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = contactForm.elements["name"].value.trim();
      const email = contactForm.elements["email"].value.trim();
      const subject = contactForm.elements["subject"].value.trim();
      const message = contactForm.elements["message"].value.trim();

      const errors = [];

      if (!name) errors.push("Name is required.");
      if (!email) {
        errors.push("Email is required.");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Please enter a valid email address.");
      }
      if (!subject) errors.push("Subject is required.");
      if (!message || message.length < 10) {
        errors.push("Message must be at least 10 characters.");
      }

      if (errors.length) {
        formMessages.textContent = errors.join(" ");
        formMessages.className = "form-messages error";
      } else {
        formMessages.textContent =
          "Thank you for reaching out. Your message has been received.";
        formMessages.className = "form-messages success";
        contactForm.reset();
      }
    });
  }
});
