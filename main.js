// Main JS for Law Students' Society - JABU site

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

  /* ==========
     LSRC: Council Member Photo Upload (preview + save)
     ==========
     Requires your lsrc.html cards to use:
     <div class="member-photo" data-photo-key="lsrc-member-1"> ... </div>
  */
  (function initLSRCMemberPhotoUploads() {
    const containers = document.querySelectorAll(
      ".member-photo[data-photo-key]"
    );
    if (!containers.length) return;

    containers.forEach((box) => {
      const key = box.getAttribute("data-photo-key");
      const input = box.querySelector(".member-photo-input");
      const img = box.querySelector(".member-photo-img");
      const removeBtn = box.querySelector(".member-photo-remove");

      // Guard: if markup isn't complete, skip safely
      if (!key || !input || !img || !removeBtn) return;

      // Load saved image (if any)
      const saved = localStorage.getItem(key);
      if (saved) {
        img.src = saved;
        box.classList.add("has-image");
      }

      // Click the box to open file picker (except on remove)
      box.addEventListener("click", (e) => {
        if (e.target === removeBtn) return;
        input.click();
      });

      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;

        // images only
        if (!file.type || !file.type.startsWith("image/")) {
          alert("Please select an image file.");
          input.value = "";
          return;
        }

        // Optional: soft size guard (prevents huge localStorage issues)
        // 1.5MB is a safe-ish limit for base64 saving
        const MAX_BYTES = 1.5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
          alert("Image too large. Please use an image under ~1.5MB.");
          input.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;

          img.src = dataUrl;
          box.classList.add("has-image");

          try {
            localStorage.setItem(key, dataUrl);
          } catch (err) {
            // If storage is full, still show preview but warn user
            console.warn("Could not save image to localStorage:", err);
            alert(
              "Preview shown, but could not save in this browser (storage full)."
            );
          }
        };
        reader.readAsDataURL(file);
      });

      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        localStorage.removeItem(key);
        img.removeAttribute("src");
        input.value = "";
        box.classList.remove("has-image");
      });
    });
  })();
});
