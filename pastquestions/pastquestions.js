// pastquestions.js (Truehost PHP + MySQL API edition)
// Public page loads from jabumarket.com.ng/lss_api and renders cards.
// If API fails, falls back to local resources.json (optional).

const API_BASE = "https://jabumarket.com.ng/lss_api";

const $ = (id) => document.getElementById(id);

const els = {
  level: $("level"),
  semester: $("semester"),
  type: $("type"),
  q: $("q"),
  clearBtn: $("clearBtn"),
  stats: $("stats"),
  grid: $("grid"),
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, needle) {
  const t = String(text ?? "");
  const n = String(needle ?? "").trim();
  if (!n) return esc(t);
  const re = new RegExp(`(${escapeRegExp(n)})`, "ig");
  // escape first, then highlight by operating on escaped string is messy.
  // instead: split on raw string and escape pieces.
  const parts = t.split(re);
  return parts
    .map((p, i) => {
      if (i % 2 === 1) return `<mark class="pq-mark">${esc(p)}</mark>`;
      return esc(p);
    })
    .join("");
}

function normalize(x = {}) {
  const url = String(x.file_url || x.url || x.fileUrl || "").trim();

  const formatGuess =
    (String(x.format || x.fileType || "").toLowerCase() ||
      (url.toLowerCase().endsWith(".pdf") ? "pdf" : "image")) === "pdf"
      ? "pdf"
      : "image";

  const course_code = String(x.course_code || x.courseCode || "").trim();
  const course_title = String(x.course_title || x.courseTitle || "").trim();

  // Friendly title (prefer course_code as "main")
  const titleRaw = String(
    x.title ||
      (course_code ? course_code : "") ||
      (course_title ? course_title : "") ||
      "Untitled"
  ).trim();

  return {
    id: x.id ?? null,
    title: titleRaw,
    course_code,
    course_title,
    level: String(x.level || "").trim(),
    semester: String(x.semester || "").trim(),
    type: String(x.type || "Exam").trim(),
    session: String(x.session || x.academic_session || x.year || "").trim(),
    year: String(x.year || "").trim(),
    notes: String(x.notes || "").trim(),
    format: formatGuess,
    url,
    created_at: String(x.created_at || x.createdAt || "").trim(),
  };
}

function metaLine(item) {
  const bits = [];
  if (item.session) bits.push(item.session);
  if (item.semester) bits.push(item.semester);
  if (item.type) bits.push(item.type);
  if (item.level) bits.push(item.level);
  return bits.join(" • ");
}

function isUnsorted(item) {
  const u = (v) => String(v || "").toUpperCase();
  return (
    u(item.level) === "UNSORTED" ||
    u(item.semester) === "UNSORTED" ||
    u(item.type) === "UNSORTED"
  );
}

function buildCard(item, needle = "") {
  const badge = item.format === "pdf" ? "PDF" : "IMAGE";
  const meta = metaLine(item);

  const mainTitle = item.course_code || item.title || "Untitled";
  const subTitle =
    item.course_code && item.course_title
      ? item.course_title
      : item.course_title || (item.course_code ? "" : item.title);

  const hint = item.notes || "";

  const href = item.url || "#";
  const canOpen = Boolean(item.url);

  // For actions
  const openLabel = item.format === "pdf" ? "Open PDF" : "Open Image";
  const downloadLabel = item.format === "pdf" ? "Download" : "Download";

  const unsorted = isUnsorted(item);

  return `
    <article class="pq-card" data-id="${esc(item.id ?? "")}">
      <button class="pq-cardMain" type="button" data-action="preview" ${
        canOpen ? "" : "disabled"
      } aria-label="Preview ${esc(mainTitle)}">
        <div class="pq-cardTop">
          <span class="pq-badge">${esc(badge)}</span>
          ${unsorted ? `<span class="pq-chip pq-chip--warn">UNSORTED</span>` : ""}
        </div>

        <h3 class="pq-cardTitle">${highlight(mainTitle, needle)}</h3>
        ${
          subTitle
            ? `<p class="pq-cardSub">${highlight(subTitle, needle)}</p>`
            : ""
        }

        ${
          meta
            ? `<div class="pq-cardMeta">${highlight(meta, needle)}</div>`
            : `<div class="pq-cardMeta pq-muted">—</div>`
        }

        ${
          hint
            ? `<div class="pq-cardHint">${highlight(hint, needle)}</div>`
            : ""
        }
      </button>

      <div class="pq-cardActions">
        <button class="pq-btn pq-btn--ghost" type="button" data-action="preview" ${
          canOpen ? "" : "disabled"
        }>Preview</button>

        ${
          canOpen
            ? `<a class="pq-btn pq-btn--primary" data-action="download" href="${esc(
                href
              )}" target="_blank" rel="noopener" download>${esc(downloadLabel)}</a>`
            : `<button class="pq-btn pq-btn--primary" type="button" disabled>Unavailable</button>`
        }

        ${
          canOpen
            ? `<a class="pq-btn pq-btn--link" data-action="open" href="${esc(
                href
              )}" target="_blank" rel="noopener">${esc(openLabel)}</a>`
            : ``
        }
      </div>
    </article>
  `;
}

function setStats(text) {
  if (els.stats) els.stats.textContent = text;
}

function getFilters() {
  return {
    level: (els.level?.value || "").trim(),
    semester: (els.semester?.value || "").trim(),
    type: (els.type?.value || "").trim(),
    q: (els.q?.value || "").trim(),
  };
}

function toQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) usp.set(k, v);
  });
  return usp.toString() ? `?${usp.toString()}` : "";
}

async function fetchApiList(filters) {
  const qs = toQuery({ ...filters, limit: 200 });
  const res = await fetch(`${API_BASE}/pastquestions/list.php${qs}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "API error");
  return (data.items || []).map(normalize);
}

async function fetchFallbackJson(filters) {
  const res = await fetch("./resources.json", { cache: "no-store" });
  const arr = await res.json();
  const items = (Array.isArray(arr) ? arr : []).map(normalize);

  // Apply client-side filters
  const { level, semester, type, q } = filters;
  const needle = q.toLowerCase();

  return items.filter((it) => {
    if (level && it.level !== level) return false;
    if (semester && it.semester !== semester) return false;
    if (type && it.type !== type) return false;
    if (needle) {
      const blob = `${it.title} ${it.course_code} ${it.course_title} ${it.session} ${it.semester} ${it.type} ${it.level} ${it.notes}`.toLowerCase();
      if (!blob.includes(needle)) return false;
    }
    return true;
  });
}

let lastItems = [];

/* ---------------------------
   Modal Preview (PDF + Image)
---------------------------- */
let modal = null;

function ensureModal() {
  if (modal) return modal;

  const wrap = document.createElement("div");
  wrap.className = "pq-modal";
  wrap.id = "pqModal";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = `
    <div class="pq-modalBackdrop" data-action="close"></div>
    <div class="pq-modalPanel" role="dialog" aria-modal="true" aria-label="Preview">
      <div class="pq-modalHeader">
        <div class="pq-modalHeadText">
          <div class="pq-modalKicker" id="pqModalMeta">—</div>
          <div class="pq-modalTitle" id="pqModalTitle">Preview</div>
        </div>
        <button class="pq-iconBtn" type="button" data-action="close" aria-label="Close preview">✕</button>
      </div>

      <div class="pq-modalBody">
        <div class="pq-modalViewer" id="pqModalViewer">
          <!-- injected -->
        </div>
      </div>

      <div class="pq-modalFooter">
        <a class="pq-btn pq-btn--ghost" id="pqModalOpen" href="#" target="_blank" rel="noopener">Open</a>
        <a class="pq-btn pq-btn--primary" id="pqModalDownload" href="#" target="_blank" rel="noopener" download>Download</a>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const close = () => closeModal();
  wrap.addEventListener("click", (e) => {
    const act = e.target?.getAttribute?.("data-action");
    if (act === "close") close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && wrap.classList.contains("is-open")) close();
  });

  modal = {
    root: wrap,
    title: wrap.querySelector("#pqModalTitle"),
    meta: wrap.querySelector("#pqModalMeta"),
    viewer: wrap.querySelector("#pqModalViewer"),
    open: wrap.querySelector("#pqModalOpen"),
    download: wrap.querySelector("#pqModalDownload"),
  };
  return modal;
}

function openModal(item) {
  const m = ensureModal();
  const title = item.course_code || item.title || "Preview";
  const meta = metaLine(item) || "—";

  m.title.textContent = title;
  m.meta.textContent = meta;

  const href = item.url || "#";
  m.open.href = href;
  m.download.href = href;

  // Viewer
  m.viewer.innerHTML = "";

  if (!item.url) {
    m.viewer.innerHTML = `<div class="pq-modalEmpty">File unavailable.</div>`;
  } else if (item.format === "pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = href;
    iframe.title = `PDF Preview - ${title}`;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer";
    iframe.className = "pq-iframe";
    m.viewer.appendChild(iframe);
  } else {
    const img = document.createElement("img");
    img.src = href;
    img.alt = title;
    img.loading = "lazy";
    img.className = "pq-previewImg";
    img.addEventListener("click", () => window.open(href, "_blank", "noopener"));
    m.viewer.appendChild(img);

    const tip = document.createElement("div");
    tip.className = "pq-modalTip";
    tip.textContent = "Tip: Click the image to view full size.";
    m.viewer.appendChild(tip);
  }

  document.body.classList.add("pq-modalOpen");
  m.root.classList.add("is-open");
  m.root.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const m = ensureModal();
  m.root.classList.remove("is-open");
  m.root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("pq-modalOpen");
}

/* ---------------------------
   Render / Load
---------------------------- */
function render(items, filters) {
  const needle = (filters.q || "").trim();
  if (!els.grid) return;

  // render
  els.grid.innerHTML = items.map((it) => buildCard(it, needle)).join("");
}

async function load() {
  const filters = getFilters();
  setStats("Loading…");
  if (els.grid) els.grid.innerHTML = "";

  try {
    lastItems = await fetchApiList(filters);
  } catch {
    // Fallback to local resources.json if API fails
    try {
      lastItems = await fetchFallbackJson(filters);
    } catch {
      lastItems = [];
    }
  }

  if (!lastItems.length) {
    if (els.grid) {
      els.grid.innerHTML = `
        <div class="pq-empty">
          <div class="pq-empty-title">No results</div>
          <div class="pq-empty-sub">Try changing the filters or search term.</div>
        </div>
      `;
    }
    setStats("0 items");
    return;
  }

  render(lastItems, filters);
  setStats(`${lastItems.length} item(s)`);
}

function clearFilters() {
  if (els.level) els.level.value = "";
  if (els.semester) els.semester.value = "";
  if (els.type) els.type.value = "";
  if (els.q) els.q.value = "";
  load();
}

function findItemFromCard(cardEl) {
  if (!cardEl) return null;
  const id = cardEl.getAttribute("data-id");
  if (!id) return null;
  // id may be "" if api doesn't provide id, so fallback by using position is hard.
  // We'll also store url on action buttons? (not needed if id exists)
  const item = lastItems.find((x) => String(x.id ?? "") === String(id));
  if (item) return item;

  // fallback: try to match by title text
  const titleText = cardEl.querySelector(".pq-cardTitle")?.textContent?.trim() || "";
  return lastItems.find((x) => (x.course_code || x.title || "").trim() === titleText) || null;
}

function init() {
  // Filter listeners
  ["change"].forEach((evt) => {
    els.level?.addEventListener(evt, load);
    els.semester?.addEventListener(evt, load);
    els.type?.addEventListener(evt, load);
  });

  // Debounced search
  let t = null;
  els.q?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(load, 180);
  });

  els.clearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    clearFilters();
  });

  // Event delegation for preview
  els.grid?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    const card = e.target.closest(".pq-card");
    if (!card) return;

    const action = btn?.getAttribute("data-action");

    // Download/Open: let anchor default do its job
    if (action === "download" || action === "open") return;

    // Preview click anywhere on the card main or preview button
    if (action === "preview" || !action) {
      const item = findItemFromCard(card);
      if (!item) return;
      openModal(item);
    }
  });

  load();
}

document.addEventListener("DOMContentLoaded", init);
