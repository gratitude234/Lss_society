/* pastquestions/admin.js (Truehost PHP + MySQL API edition)
   - Site can stay on Vercel (jabulss.com)
   - Upload API runs on Truehost (jabumarket.com.ng/lss_api)
   - Public page reads list from API; uploads go to Truehost /uploads
*/

const API_BASE = (() => {
  // Change if your API subdomain is different
  // Folder-based API (your setup): https://jabumarket.com.ng/lss_api
  // If you later move to a subdomain API, replace this with that subdomain.
  const hard = "https://jabumarket.com.ng/lss_api";
  return hard;
})();

const STORAGE_KEY = "pq_admin_draft_v3";
const TOKEN_KEY = "lssAdminToken";

const $ = (id) => document.getElementById(id);

const toastEl = $("toast");
let toastTimer = null;
function toast(msg, type = "ok") {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `toast ${type}`;
  toastEl.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.style.display = "none"), 3200);
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
  } catch { draft = { items: [] }; }
}
function saveDraft() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch {}
}
function clearDraft() {
  draft = { items: [] };
  saveDraft();
  renderTable([]);
  updateCounts();
}

function normalizeItem(x = {}) {
  const format = safeStr(x.format || x.fileType || x.kind).toLowerCase() || (safeStr(x.url).toLowerCase().endsWith(".pdf") ? "pdf" : "image");
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
    format: format === "pdf" ? "pdf" : "image",
    file_url: safeStr(x.file_url || x.url || x.fileUrl),
    created_at: x.created_at || x.createdAt || null,
  };
}

/** UI refs **/
const fileEl = $("file");
const safeNameEl = $("safeName");
const levelEl = $("level");
const semesterEl = $("semester");
const typeEl = $("type");
const sessionEl = $("session");
const courseCodeEl = $("courseCode");
const courseTitleEl = $("courseTitle");
const titleEl = $("title");
const yearEl = $("year");
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

const btnImportFile = $("btnImportFile");
const btnImportPublish = $("btnImportFirestore"); // keep existing id
const importFileEl = $("importFile");

const countTotalEl = $("countTotal");
const countUnsortedEl = $("countUnsorted");
const tbodyEl = $("tbody");

/** Auth UI **/
const loginEmailEl = $("loginEmail");
const loginPasswordEl = $("loginPassword");
const btnLogin = $("btnLogin");
const btnLogout = $("btnLogout");
const authStatusEl = $("authStatus");

function setAuthUI(signedIn, email = "") {
  if (!authStatusEl) return;
  authStatusEl.textContent = signedIn ? `Signed in: ${email || "Admin"}` : "Not signed in";
  authStatusEl.style.borderColor = signedIn ? "rgba(35,181,168,.55)" : "rgba(255,255,255,.12)";
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
    toast("Logged in ✅", "ok");
    loginPasswordEl.value = "";
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
  const course_code = safeStr(courseCodeEl?.value);
  const course_title = safeStr(courseTitleEl?.value);
  const level = safeStr(levelEl?.value);
  const semester = safeStr(semesterEl?.value);
  const type = safeStr(typeEl?.value);
  const session = safeStr(sessionEl?.value);
  const year = safeStr(yearEl?.value);
  const notes = safeStr(notesEl?.value);

  const displayTitle = rawTitle || [course_code, course_title].filter(Boolean).join(" — ") || "Untitled";
  const format = (fileEl?.files?.[0]?.type || "").includes("pdf") ? "pdf" : "image";

  return {
    title: displayTitle,
    course_code,
    course_title,
    level,
    semester,
    type,
    session,
    year,
    notes,
    format,
  };
}

function autoFillFromFilename() {
  const f = fileEl?.files?.[0];
  if (!f) return toast("Choose a file first.", "warn");

  const name = f.name.replace(/\.[^.]+$/, "");
  safeNameEl.value = toKebab(name).slice(0, 80);
  if (!titleEl.value) titleEl.value = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!courseCodeEl.value) {
    const m = name.match(/\b([A-Z]{2,5}\s?\d{2,4})\b/i);
    if (m) courseCodeEl.value = m[1].toUpperCase().replace(/\s+/g, " ");
  }
  toast("Auto-filled from filename.", "ok");
}

function addToDraft() {
  const item = normalizeItem({ ...currentFormItem(), file_url: "" });
  draft.items.unshift(item);
  saveDraft();
  renderTable(draft.items);
  updateCounts();
  toast("Added to draft.", "ok");
}

function updateCounts() {
  const items = draft.items || [];
  const total = items.length;
  const uns = items.filter((x) => !(x.level && x.semester && (x.course_code || x.title))).length;
  if (countTotalEl) countTotalEl.textContent = String(total);
  if (countUnsortedEl) countUnsortedEl.textContent = String(uns);
}

function renderTable(items) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = "";
  const rows = items.map((it, idx) => {
    const t = normalizeItem(it);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${idx + 1}</td>
      <td>
        <div class="t">${escapeHtml(t.title || "(no title)")}</div>
        <div class="s">${escapeHtml([t.course_code, t.course_title].filter(Boolean).join(" • "))}</div>
      </td>
      <td class="mono">${escapeHtml(t.level)}</td>
      <td class="mono">${escapeHtml(t.semester)}</td>
      <td class="mono">${escapeHtml(t.type)}</td>
      <td class="mono">${escapeHtml(t.session || t.year)}</td>
      <td class="mono">${escapeHtml(t.format)}</td>
      <td class="right">
        <button class="mini" data-act="edit" data-i="${idx}">Edit</button>
        <button class="mini danger" data-act="remove" data-i="${idx}">Remove</button>
      </td>
    `;
    return tr;
  });

  rows.forEach((r) => tbodyEl.appendChild(r));

  tbodyEl.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const i = Number(btn.getAttribute("data-i"));
      if (!Number.isFinite(i)) return;
      if (act === "remove") {
        draft.items.splice(i, 1);
        saveDraft();
        renderTable(draft.items);
        updateCounts();
        return;
      }
      if (act === "edit") {
        const it = normalizeItem(draft.items[i]);
        if (titleEl) titleEl.value = it.title || "";
        if (courseCodeEl) courseCodeEl.value = it.course_code || "";
        if (courseTitleEl) courseTitleEl.value = it.course_title || "";
        if (levelEl) levelEl.value = it.level || "";
        if (semesterEl) semesterEl.value = it.semester || "";
        if (typeEl) typeEl.value = it.type || "";
        if (sessionEl) sessionEl.value = it.session || "";
        if (yearEl) yearEl.value = it.year || "";
        if (notesEl) notesEl.value = it.notes || "";
        toast("Loaded draft item into form.", "ok");
      }
    });
  });
}

function escapeHtml(s) {
  return safeStr(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function uploadNow() {
  const f = fileEl?.files?.[0];
  if (!f) return toast("Choose a PDF/image to upload.", "warn");

  const token = getToken();
  if (!token) return toast("Login first (Admin Login section).", "warn");

  const item = currentFormItem();

  // Safe name (optional)
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
    btnUpload && (btnUpload.disabled = true);
    const data = await apiFetch("/pastquestions/upload.php", { method: "POST", body: fd });
    const uploaded = normalizeItem(data.item || {});
    if (urlPreviewEl) urlPreviewEl.textContent = uploaded.file_url || "(no url)";
    if (idPreviewEl) idPreviewEl.textContent = uploaded.id ? String(uploaded.id) : "-";
    toast("Uploaded & published ✅", "ok");
  } catch (e) {
    toast(e.message || "Upload failed.", "bad");
  } finally {
    btnUpload && (btnUpload.disabled = false);
  }
}

async function loadLive() {
  try {
    const data = await apiFetch("/pastquestions/list.php?limit=500");
    const items = (data.items || []).map(normalizeItem);
    draft.items = items;
    saveDraft();
    renderTable(draft.items);
    updateCounts();
    toast("Loaded live list.", "ok");
  } catch (e) {
    toast(e.message || "Failed to load live list.", "bad");
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
      renderTable(draft.items);
      updateCounts();
      toast("Imported JSON into draft.", "ok");
    } catch (e) {
      toast(e.message || "Import failed.", "bad");
    }
  };
  reader.readAsText(f);
}

async function publishImported() {
  const token = getToken();
  if (!token) return toast("Login first.", "warn");

  const items = (draft.items || []).map(normalizeItem).filter((x) => x.title || x.course_code || x.file_url);
  if (!items.length) return toast("Nothing to publish.", "warn");

  try {
    btnImportPublish && (btnImportPublish.disabled = true);
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
    btnImportPublish && (btnImportPublish.disabled = false);
  }
}

/** Wire up **/
function init() {
  loadDraft();
  renderTable(draft.items || []);
  updateCounts();

  btnAuto?.addEventListener("click", autoFillFromFilename);
  btnAdd?.addEventListener("click", addToDraft);
  btnUpload?.addEventListener("click", uploadNow);
  btnReset?.addEventListener("click", () => {
    fileEl.value = "";
    safeNameEl.value = "";
    toast("Form cleared.", "ok");
  });

  btnLoadLive?.addEventListener("click", loadLive);
  btnExport?.addEventListener("click", exportJson);
  btnClearDraft?.addEventListener("click", () => {
    clearDraft();
    toast("Draft cleared.", "ok");
  });

  btnImportFile?.addEventListener("click", importFromFile);
  btnImportPublish?.addEventListener("click", publishImported);

  // Preview: show file name as safe_name helper
  fileEl?.addEventListener("change", () => {
    const f = fileEl.files?.[0];
    if (!f) return;
    if (!safeNameEl.value) safeNameEl.value = toKebab(f.name.replace(/\.[^.]+$/, "")).slice(0, 80);
  });

  btnLogin?.addEventListener("click", login);
  btnLogout?.addEventListener("click", logout);

  checkAuth();
}

document.addEventListener("DOMContentLoaded", init);
