/* pastquestions/admin.js (Truehost PHP + MySQL API edition)
   - Upload API runs on Truehost: https://jabumarket.com.ng/lss_api
   - Admin uploads to /pastquestions/upload.php
   - Public page reads list from /pastquestions/list.php
*/

const API_BASE = "https://jabumarket.com.ng/lss_api";

const STORAGE_KEY = "pq_admin_draft_v4";
const TOKEN_KEY = "lssAdminToken";

const $ = (id) => document.getElementById(id);

const toastEl = $("toast");
let toastTimer = null;

function toast(msg, type = "ok") {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = "toast";
    toastEl.style.display = "none";
  }, 3200);
  toastEl.style.display = "block";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function toKebab(s) {
  return safeStr(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

function setToken(t) {
  try {
    if (!t) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, t);
  } catch {}
}

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  let data = null;
  try {
    data = ct.includes("application/json") ? (text ? JSON.parse(text) : null) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data ?? {};
}

/** Draft state **/
let draft = { items: [] };

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    draft = raw ? JSON.parse(raw) : { items: [] };
  } catch {
    draft = { items: [] };
  }
}

function saveDraft() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch {}
}

function clearDraft() {
  draft = { items: [] };
  saveDraft();
  renderTable();
  updateCounts();
}

function normalizeItem(x = {}) {
  const file_url = safeStr(x.file_url || x.url || x.fileUrl);
  const formatGuess = safeStr(x.format || x.fileType || x.kind).toLowerCase();
  const format =
    formatGuess ||
    (file_url.toLowerCase().endsWith(".pdf") ? "pdf" : (file_url ? "image" : ""));

  return {
    id: x.id ?? null,
    title: safeStr(x.title || x.name || x.course_title || x.courseTitle),
    course_code: safeStr(x.course_code || x.courseCode),
    course_title: safeStr(x.course_title || x.courseTitle),
    level: safeStr(x.level),
    semester: safeStr(x.semester),
    type: safeStr(x.type || "Exam"),
    session: safeStr(x.session || x.academic_session),
    year: safeStr(x.year),
    notes: safeStr(x.notes),
    format: format === "pdf" ? "pdf" : (format ? "image" : ""),
    file_url,
    created_at: x.created_at || x.createdAt || null,
  };
}

function escapeHtml(s) {
  return safeStr(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** UI refs **/
const fileEl = $("file");
const safeNameEl = $("safeName");
const levelEl = $("level");
const semesterEl = $("semester");
const typeEl = $("type");
const sessionEl = $("session");
const yearInputEl = $("yearInput");
const courseCodeEl = $("courseCode");
const courseTitleEl = $("courseTitle");
const titleEl = $("title");
const notesEl = $("notes");
const urlPreviewEl = $("urlPreview");
const idPreviewEl = $("idPreview");

const btnAuto = $("btnAuto");
const btnAdd = $("btnAdd");
const btnUpload = $("btnUpload");
const btnReset = $("btnReset");

const btnLoadLive = $("btnLoadLive");
const btnExport = $("btnExport");
const btnClearDraft = $("btnClearDraft");

const btnPickImport = $("btnPickImport");
const btnImportPublish = $("btnImportFirestore");
const importFileEl = $("importFile");

const countTotalEl = $("countTotal");
const countUnsortedEl = $("countUnsorted");
const tbodyEl = $("tbody");
const searchEl = $("search");

/** Auth UI **/
const loginEmailEl = $("loginEmail");
const loginPasswordEl = $("loginPassword");
const btnLogin = $("btnLogin");
const btnLogout = $("btnLogout");
const authStatusEl = $("authStatus");

function setAuthUI(signedIn, email = "") {
  if (!authStatusEl) return;
  authStatusEl.innerHTML = signedIn
    ? `<span class="badge2"></span> Signed in: ${escapeHtml(email || "Admin")}`
    : `<span class="badge2"></span> Not signed in`;

  if (btnLogout) btnLogout.disabled = !signedIn;
}

async function checkAuth() {
  const token = getToken();
  if (!token) { setAuthUI(false); return; }

  try {
    const me = await apiFetch("/auth/me.php");
    setAuthUI(true, me?.admin?.email || "");
  } catch {
    setToken("");
    setAuthUI(false);
  }
}

async function login() {
  const email = safeStr(loginEmailEl?.value);
  const password = safeStr(loginPasswordEl?.value);
  if (!email || !password) return toast("Enter email and password.", "warn");

  try {
    const data = await apiFetch("/auth/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!data?.token) throw new Error("Login failed.");
    setToken(data.token);
    loginPasswordEl.value = "";
    toast("Logged in ✅", "ok");
    await checkAuth();
  } catch (e) {
    toast(e.message || "Login failed.", "bad");
  }
}

async function logout() {
  try { await apiFetch("/auth/logout.php", { method: "POST" }); } catch {}
  setToken("");
  setAuthUI(false);
  toast("Logged out.", "ok");
}

function currentFormItem() {
  const rawTitle = safeStr(titleEl?.value) || safeStr(courseTitleEl?.value) || safeStr(courseCodeEl?.value);

  const item = {
    title: rawTitle || "Untitled",
    course_code: safeStr(courseCodeEl?.value),
    course_title: safeStr(courseTitleEl?.value),
    level: safeStr(levelEl?.value),
    semester: safeStr(semesterEl?.value),
    type: safeStr(typeEl?.value),
    session: safeStr(sessionEl?.value),
    year: safeStr(yearInputEl?.value),
    notes: safeStr(notesEl?.value),
  };

  return item;
}

function autoFillFromFilename() {
  const f = fileEl?.files?.[0];
  if (!f) return toast("Choose a file first.", "warn");

  const nameNoExt = f.name.replace(/\.[^.]+$/, "");
  const proposed = toKebab(nameNoExt).slice(0, 80);

  if (safeNameEl) safeNameEl.value = proposed;
  if (titleEl && !titleEl.value) titleEl.value = nameNoExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (courseCodeEl && !courseCodeEl.value) {
    const m = nameNoExt.match(/\b([A-Z]{2,5}\s?\d{2,4})\b/i);
    if (m) courseCodeEl.value = m[1].toUpperCase().replace(/\s+/g, " ");
  }

  toast("Auto-filled from filename.", "ok");
}

function addToDraft() {
  const item = normalizeItem({ ...currentFormItem(), file_url: "" });
  draft.items.unshift(item);
  saveDraft();
  renderTable();
  updateCounts();
  toast("Added to draft.", "ok");
}

function updateCounts() {
  const items = draft.items || [];
  const total = items.length;

  const uns = items.filter((x) => {
    const t = normalizeItem(x);
    const hasBasics = (t.title || t.course_code) && t.level && t.semester;
    return !hasBasics;
  }).length;

  if (countTotalEl) countTotalEl.textContent = String(total);
  if (countUnsortedEl) countUnsortedEl.textContent = String(uns);
}

function matchesSearch(it, q) {
  if (!q) return true;
  const t = normalizeItem(it);
  const hay = [
    t.title, t.course_code, t.course_title, t.level, t.semester, t.type, t.session, t.year, t.file_url
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

function renderTable() {
  if (!tbodyEl) return;

  const q = safeStr(searchEl?.value).toLowerCase();
  const items = (draft.items || []).filter((it) => matchesSearch(it, q));

  tbodyEl.innerHTML = "";

  items.forEach((raw, idx) => {
    const it = normalizeItem(raw);

    const metaBits = [
      it.level && it.level !== "UNSORTED" ? it.level : "",
      it.semester && it.semester !== "UNSORTED" ? it.semester : "",
      it.type ? it.type : "",
      it.session ? it.session : "",
      it.year ? `Year: ${it.year}` : "",
      it.course_code ? it.course_code : "",
    ].filter(Boolean);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div><b>${escapeHtml(it.title || "(no title)")}</b></div>
        <div style="color: rgba(234,240,255,.62); margin-top:4px;">
          ${escapeHtml(it.course_title || "")}
        </div>
      </td>

      <td>
        ${metaBits.map((m) => `<span class="tag good">${escapeHtml(m)}</span>`).join("")}
      </td>

      <td class="mono">
        ${it.file_url
          ? `<a href="${escapeHtml(it.file_url)}" target="_blank" rel="noopener noreferrer" style="color: rgba(223,253,249,.92); text-decoration:none;">
              open
            </a>`
          : `<span style="color: rgba(234,240,255,.55);">not uploaded</span>`
        }
      </td>

      <td class="right">
        <button class="btnx ghost" data-act="edit" data-i="${idx}" type="button">Edit</button>
        <button class="btnx danger" data-act="remove" data-i="${idx}" type="button">Remove</button>
      </td>
    `;

    tbodyEl.appendChild(tr);
  });

  tbodyEl.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const i = Number(btn.getAttribute("data-i"));
      if (!Number.isFinite(i)) return;

      if (act === "remove") {
        draft.items.splice(i, 1);
        saveDraft();
        renderTable();
        updateCounts();
        return;
      }

      if (act === "edit") {
        const it = normalizeItem(draft.items[i]);

        if (titleEl) titleEl.value = it.title || "";
        if (courseCodeEl) courseCodeEl.value = it.course_code || "";
        if (courseTitleEl) courseTitleEl.value = it.course_title || "";
        if (levelEl) levelEl.value = it.level || "UNSORTED";
        if (semesterEl) semesterEl.value = it.semester || "UNSORTED";
        if (typeEl) typeEl.value = it.type || "Exam";
        if (sessionEl) sessionEl.value = it.session || "";
        if (yearInputEl) yearInputEl.value = it.year || "";
        if (notesEl) notesEl.value = it.notes || "";

        if (urlPreviewEl) urlPreviewEl.textContent = it.file_url || "—";
        if (idPreviewEl) idPreviewEl.textContent = it.id ? String(it.id) : "—";

        toast("Loaded item into form.", "ok");
      }
    });
  });
}

async function uploadNow() {
  const f = fileEl?.files?.[0];
  if (!f) return toast("Choose a PDF/image to upload.", "warn");

  const token = getToken();
  if (!token) return toast("Login first (Admin Login section).", "warn");

  const item = currentFormItem();
  const safeName = safeStr(safeNameEl?.value) || toKebab(item.title).slice(0, 80);

  const fd = new FormData();
  fd.append("file", f);
  fd.append("safe_name", safeName);

  fd.append("title", item.title);
  fd.append("course_code", item.course_code);
  fd.append("course_title", item.course_title);
  fd.append("level", item.level);
  fd.append("semester", item.semester);
  fd.append("type", item.type);
  fd.append("session", item.session);
  fd.append("year", item.year);
  fd.append("notes", item.notes);

  try {
    if (btnUpload) btnUpload.disabled = true;

    const data = await apiFetch("/pastquestions/upload.php", {
      method: "POST",
      body: fd,
    });

    const uploaded = normalizeItem(data.item || {});
    if (urlPreviewEl) urlPreviewEl.textContent = uploaded.file_url || "—";
    if (idPreviewEl) idPreviewEl.textContent = uploaded.id ? String(uploaded.id) : "—";

    toast("Uploaded & published ✅", "ok");

    // Refresh live list into draft
    await loadLive();
  } catch (e) {
    toast(e.message || "Upload failed.", "bad");
  } finally {
    if (btnUpload) btnUpload.disabled = false;
  }
}

async function loadLive() {
  try {
    const data = await apiFetch("/pastquestions/list.php?limit=800");
    const items = (data.items || []).map(normalizeItem);
    draft.items = items;
    saveDraft();
    renderTable();
    updateCounts();
    toast("Loaded live library ✅", "ok");
  } catch (e) {
    toast(e.message || "Failed to load live library.", "bad");
  }
}

function exportJson() {
  const items = (draft.items || []).map(normalizeItem);
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pastquestions_export_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function importFromFile() {
  const f = importFileEl?.files?.[0];
  if (!f) return toast("Choose a JSON file first.", "warn");

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(String(reader.result || "[]"));
      if (!Array.isArray(arr)) throw new Error("JSON must be an array.");

      draft.items = arr.map(normalizeItem);
      saveDraft();
      renderTable();
      updateCounts();
      toast("Imported JSON into draft ✅", "ok");
    } catch (e) {
      toast(e.message || "Import failed.", "bad");
    }
  };
  reader.readAsText(f);
}

async function publishImported() {
  const token = getToken();
  if (!token) return toast("Login first.", "warn");

  const items = (draft.items || [])
    .map(normalizeItem)
    .filter((x) => x.title || x.course_code || x.file_url);

  if (!items.length) return toast("Nothing to publish.", "warn");

  try {
    if (btnImportPublish) btnImportPublish.disabled = true;

    const data = await apiFetch("/pastquestions/import.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    toast(`Imported ${data.inserted || 0} item(s) ✅`, "ok");
    await loadLive();
  } catch (e) {
    toast(e.message || "Publish import failed.", "bad");
  } finally {
    if (btnImportPublish) btnImportPublish.disabled = false;
  }
}

/** Init **/
function init() {
  loadDraft();
  renderTable();
  updateCounts();

  btnAuto?.addEventListener("click", autoFillFromFilename);
  btnAdd?.addEventListener("click", addToDraft);
  btnUpload?.addEventListener("click", uploadNow);

  btnReset?.addEventListener("click", () => {
    if (fileEl) fileEl.value = "";
    if (safeNameEl) safeNameEl.value = "";
    if (titleEl) titleEl.value = "";
    if (courseCodeEl) courseCodeEl.value = "";
    if (courseTitleEl) courseTitleEl.value = "";
    if (sessionEl) sessionEl.value = "";
    if (yearInputEl) yearInputEl.value = "";
    if (notesEl) notesEl.value = "";
    if (urlPreviewEl) urlPreviewEl.textContent = "—";
    if (idPreviewEl) idPreviewEl.textContent = "—";
    toast("Form reset.", "ok");
  });

  btnLoadLive?.addEventListener("click", loadLive);
  btnExport?.addEventListener("click", exportJson);
  btnClearDraft?.addEventListener("click", () => {
    clearDraft();
    toast("Draft cleared.", "ok");
  });

  btnPickImport?.addEventListener("click", () => importFileEl?.click());
  importFileEl?.addEventListener("change", importFromFile);

  btnImportPublish?.addEventListener("click", publishImported);

  fileEl?.addEventListener("change", () => {
    const f = fileEl.files?.[0];
    if (!f) return;
    if (safeNameEl && !safeNameEl.value) {
      safeNameEl.value = toKebab(f.name.replace(/\.[^.]+$/, "")).slice(0, 80);
    }
    if (urlPreviewEl) urlPreviewEl.textContent = "—";
    if (idPreviewEl) idPreviewEl.textContent = "—";
  });

  searchEl?.addEventListener("input", renderTable);

  btnLogin?.addEventListener("click", login);
  btnLogout?.addEventListener("click", logout);

  checkAuth();
}

document.addEventListener("DOMContentLoaded", init);
