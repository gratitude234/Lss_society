// pastquestions.js (Truehost PHP + MySQL API edition)
// Public page loads from jabumarket.com.ng/lss_api and renders cards.
// If API fails, falls back to local resources.json (optional).

// Your Truehost API base.
// If your API is a folder under a domain (e.g. https://jabumarket.com.ng/lss_api), put that full path here.
// If you later move to a subdomain (e.g. https://api.jabulss.com), change it accordingly.
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

function normalize(x = {}) {
  const url = String(x.file_url || x.url || x.fileUrl || "").trim();
  const format =
    (String(x.format || x.fileType || "").toLowerCase() || (url.toLowerCase().endsWith(".pdf") ? "pdf" : "image")) === "pdf"
      ? "pdf"
      : "image";

  return {
    id: x.id ?? null,
    title: String(x.title || x.course_title || x.courseTitle || x.course_code || "Untitled"),
    course_code: String(x.course_code || x.courseCode || ""),
    course_title: String(x.course_title || x.courseTitle || ""),
    level: String(x.level || ""),
    semester: String(x.semester || ""),
    type: String(x.type || "Exam"),
    session: String(x.session || x.academic_session || x.year || ""),
    year: String(x.year || ""),
    notes: String(x.notes || ""),
    format,
    url,
    created_at: x.created_at || x.createdAt || "",
  };
}

function buildCard(item) {
  const badge = item.format === "pdf" ? "PDF" : "IMAGE";
  const meta = [item.course_code, item.level && `${item.level}`, item.semester && `${item.semester}`, item.type && item.type]
    .filter(Boolean)
    .join(" • ");

  const subtitle = item.course_title && item.course_code ? `${item.course_code} — ${item.course_title}` : (item.course_title || item.course_code || "");
  const hint = item.session || item.year || "";

  const href = item.url || "#";
  const openText = item.format === "pdf" ? "Open PDF" : "Open Image";

  return `
    <article class="pq-card">
      <div class="pq-top">
        <div class="pq-badge">${esc(badge)}</div>
        <div class="pq-meta">${esc(meta)}</div>
      </div>

      <h3 class="pq-title">${esc(item.title)}</h3>
      ${subtitle ? `<div class="pq-sub">${esc(subtitle)}</div>` : ""}

      <div class="pq-bottom">
        <div class="pq-hint">${esc(hint)}</div>
        <a class="pq-btn" href="${esc(href)}" target="_blank" rel="noopener">${esc(openText)}</a>
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
  const res = await fetch(`${API_BASE}/pastquestions/list.php${qs}`);
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
      const blob = `${it.title} ${it.course_code} ${it.course_title} ${it.session} ${it.notes}`.toLowerCase();
      if (!blob.includes(needle)) return false;
    }
    return true;
  });
}

let lastItems = [];
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

  if (els.grid) els.grid.innerHTML = lastItems.map(buildCard).join("");
  setStats(`${lastItems.length} item(s)`);
}

function clearFilters() {
  if (els.level) els.level.value = "";
  if (els.semester) els.semester.value = "";
  if (els.type) els.type.value = "";
  if (els.q) els.q.value = "";
  load();
}

function init() {
  ["change", "input"].forEach((evt) => {
    els.level?.addEventListener(evt, load);
    els.semester?.addEventListener(evt, load);
    els.type?.addEventListener(evt, load);
    els.q?.addEventListener(evt, () => {
      // small debounce
      clearTimeout(init._t);
      init._t = setTimeout(load, 160);
    });
  });

  els.clearBtn?.addEventListener("click", clearFilters);

  load();
}

document.addEventListener("DOMContentLoaded", init);
