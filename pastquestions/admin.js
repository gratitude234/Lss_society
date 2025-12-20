/* pastquestions/admin.js
   Minimal Admin:
   - Login
   - Upload
   - Edit metadata
   - Rename file on server
   - Delete
   + Preview selected upload file before uploading
   + Preview any existing uploaded file inside a modal
   + UX upgrades: mobile nav toggle, list loading state, focus restore
*/

const API_BASE = "https://jabumarket.com.ng/lss_api";
const TOKEN_KEY = "lssAdminToken";

const $ = (id) => document.getElementById(id);

const toastEl = $("toast");
let toastTimer = null;
function toast(msg, type = "ok") {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
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

/* ---------- NAV (mobile) ---------- */
function initMobileNav() {
  const navToggle = $("navToggle");
  const navLinks = $("navLinks");
  if (!navToggle || !navLinks) return;

  function close() {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (e) => {
    if (!navLinks.classList.contains("open")) return;
    const t = e.target;
    if (t === navToggle || navLinks.contains(t)) return;
    close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

/* ---------- AUTH ---------- */
const authPill = $("authPill");
const btnLogin = $("btnLogin");
const btnLogout = $("btnLogout");

async function checkAuth() {
  const token = getToken();
  if (!token) {
    setSignedOut();
    return false;
  }
  try {
    const me = await apiFetch("/auth/me.php", { method: "GET" });
    if (me?.success && me?.admin?.email) {
      authPill.textContent = `Signed in: ${me.admin.email}`;
      authPill.classList.add("good");
      btnLogout.style.display = "";
      return true;
    }
  } catch {
    // token invalid/expired
  }
  setToken("");
  setSignedOut();
  return false;
}

function setSignedOut() {
  authPill.textContent = "Not signed in";
  authPill.classList.remove("good");
  btnLogout.style.display = "none";
}

async function login() {
  const email = safeStr($("loginEmail")?.value);
  const password = String($("loginPassword")?.value || "");
  if (!email || !password) return toast("Email + password required.", "warn");

  try {
    btnLogin.disabled = true;
    const data = await apiFetch("/auth/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!data?.token) throw new Error("No token returned.");
    setToken(data.token);
    toast("Login successful ✅", "ok");
    await checkAuth();
    await loadList();
  } catch (e) {
    toast(e.message || "Login failed.", "bad");
  } finally {
    btnLogin.disabled = false;
  }
}

async function logout() {
  setToken("");
  setSignedOut();
  toast("Logged out.", "ok");
}

/* ---------- LIST / TABLE ---------- */
const tbody = $("tbody");
const countPill = $("countPill");

const qEl = $("q");
const fLevel = $("fLevel");
const fSemester = $("fSemester");
const fType = $("fType");

const btnRefresh = $("btnRefresh");
const btnRefreshTop = $("btnRefreshTop");

let currentItems = [];
let listLoading = false;

function escapeHtml(s) {
  return safeStr(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fileBaseFromItem(it) {
  const url = safeStr(it?.file_url || it?.fileUrl || "");
  const last = url.split("/").pop() || "";
  const base = last.replace(/\.[^.]+$/, "");
  return toKebab(base) || "past-question";
}

function setListLoading(on) {
  listLoading = !!on;
  if (btnRefresh) btnRefresh.disabled = on;
  if (btnRefreshTop) btnRefreshTop.disabled = on;

  if (countPill) {
    if (on) {
      countPill.textContent = "Loading…";
      countPill.classList.add("warn");
    } else {
      countPill.classList.remove("warn");
    }
  }
}

function renderLoadingRow() {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="mono">Loading past questions…</td>
    </tr>
  `;
}

/* ---------- VIEW MODAL ---------- */
const viewOverlay = $("viewOverlay");
const viewFrame = $("viewFrame");
const viewTitle = $("viewTitle");
const viewMeta = $("viewMeta");
const viewOpen = $("viewOpen");
const btnViewClose = $("btnViewClose");

let lastFocusEl = null;

function openView(it) {
  if (!viewOverlay || !viewFrame) return;

  const title = safeStr(it?.title) || "Preview";
  const fileUrl = safeStr(it?.file_url || it?.fileUrl || "");
  const fileName = fileUrl ? (fileUrl.split("/").pop() || "") : "";

  if (!fileUrl) {
    toast("No file URL on this item.", "warn");
    return;
  }

  lastFocusEl = document.activeElement;

  viewTitle.textContent = title;
  if (viewMeta) viewMeta.textContent = fileName ? fileName : fileUrl;

  if (viewOpen) viewOpen.href = fileUrl;

  viewFrame.src = fileUrl;
  viewOverlay.classList.add("open");
  btnViewClose?.focus();
}

function closeView() {
  if (!viewOverlay) return;
  viewOverlay.classList.remove("open");
  if (viewFrame) viewFrame.src = "about:blank";
  if (lastFocusEl && typeof lastFocusEl.focus === "function") lastFocusEl.focus();
  lastFocusEl = null;
}

/* ---------- LOCAL PREVIEW (UPLOAD) ---------- */
const fileEl = $("file");
const btnPreviewLocal = $("btnPreviewLocal");
const btnCloseLocalPreview = $("btnCloseLocalPreview");
const localPreviewWrap = $("localPreviewWrap");
const localPreviewFrame = $("localPreviewFrame");
const localPreviewName = $("localPreviewName");

let localObjectUrl = "";

function clearLocalPreview() {
  if (localPreviewFrame) localPreviewFrame.src = "about:blank";
  if (localPreviewWrap) localPreviewWrap.style.display = "none";
  if (localPreviewName) localPreviewName.textContent = "No file selected";
  if (localObjectUrl) {
    try { URL.revokeObjectURL(localObjectUrl); } catch {}
  }
  localObjectUrl = "";
}

function showLocalPreviewForFile(f) {
  if (!f) return clearLocalPreview();
  if (!localPreviewFrame || !localPreviewWrap) return;

  const isPdf = (f.type === "application/pdf") || /\.pdf$/i.test(f.name);
  const isImage = (f.type || "").startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(f.name);

  if (!isPdf && !isImage) {
    toast("Preview supports PDF/images only.", "warn");
    clearLocalPreview();
    return;
  }

  if (localObjectUrl) {
    try { URL.revokeObjectURL(localObjectUrl); } catch {}
  }
  localObjectUrl = URL.createObjectURL(f);

  localPreviewFrame.src = localObjectUrl;
  localPreviewWrap.style.display = "block";
  if (localPreviewName) localPreviewName.textContent = f.name;
}

/* ---------- UPLOAD ---------- */
const upTitle = $("title");
const upCourseCode = $("course_code");
const upCourseTitle = $("course_title");
const upLevel = $("level");
const upSemester = $("semester");
const upType = $("type");
const upSession = $("session");
const upNotes = $("notes");
const upSafe = $("safe_name");

const btnUpload = $("btnUpload");
const btnClearUpload = $("btnClearUpload");

function clearUploadForm() {
  if (fileEl) fileEl.value = "";
  if (upTitle) upTitle.value = "";
  if (upCourseCode) upCourseCode.value = "";
  if (upCourseTitle) upCourseTitle.value = "";
  if (upLevel) upLevel.value = "";
  if (upSemester) upSemester.value = "";
  if (upType) upType.value = "Exam";
  if (upSession) upSession.value = "";
  if (upNotes) upNotes.value = "";
  if (upSafe) upSafe.value = "";
  clearLocalPreview();
}

async function uploadNow() {
  const ok = await checkAuth();
  if (!ok) return toast("Login first.", "warn");

  const f = fileEl?.files?.[0];
  if (!f) return toast("Choose a file first.", "warn");

  const title =
    safeStr(upTitle?.value) ||
    safeStr(upCourseTitle?.value) ||
    safeStr(upCourseCode?.value) ||
    "Untitled";

  const fd = new FormData();
  fd.append("file", f);
  fd.append("title", title);
  fd.append("course_code", safeStr(upCourseCode?.value));
  fd.append("course_title", safeStr(upCourseTitle?.value));
  fd.append("level", safeStr(upLevel?.value));
  fd.append("semester", safeStr(upSemester?.value));
  fd.append("type", safeStr(upType?.value || "Exam"));
  fd.append("session", safeStr(upSession?.value));
  fd.append("year", "");
  fd.append("notes", safeStr(upNotes?.value));

  const safeName = safeStr(upSafe?.value);
  if (safeName) fd.append("safe_name", toKebab(safeName));

  try {
    btnUpload.disabled = true;
    const data = await apiFetch("/pastquestions/upload.php", { method: "POST", body: fd });
    if (!data?.success) throw new Error(data?.error || "Upload failed.");
    toast("Uploaded ✅", "ok");
    clearUploadForm();
    await loadList();
  } catch (e) {
    toast(e.message || "Upload failed.", "bad");
  } finally {
    btnUpload.disabled = false;
  }
}

function renderTable(items) {
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="mono">No items found.</td>`;
    tbody.appendChild(tr);
    countPill.textContent = "0 items";
    return;
  }

  countPill.textContent = `${items.length} item(s)`;

  for (const it of items) {
    const tr = document.createElement("tr");

    const title = safeStr(it.title) || "Untitled";
    const course = [safeStr(it.course_code), safeStr(it.course_title)].filter(Boolean).join(" • ");
    const meta = [
      safeStr(it.level),
      safeStr(it.semester),
      safeStr(it.type),
      safeStr(it.session),
      safeStr(it.year),
    ].filter(Boolean).join(" • ");

    const fileUrl = safeStr(it.file_url || it.fileUrl || "");
    const fileCell = fileUrl
      ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" class="mono" style="color:inherit; text-decoration:underline;">Open</a>
         <div class="rowSub mono">${escapeHtml(fileUrl.split("/").pop() || "")}</div>`
      : `<span class="mono">—</span>`;

    const viewBtn = fileUrl
      ? `<button class="miniBtn" data-act="view" data-id="${it.id}">View</button>`
      : `<button class="miniBtn" disabled title="No file available">View</button>`;

    tr.innerHTML = `
      <td data-label="Title">
        <div>
          <div class="rowTitle">${escapeHtml(title)}</div>
          ${course ? `<div class="rowSub">${escapeHtml(course)}</div>` : `<div class="rowSub">—</div>`}
        </div>
      </td>

      <td data-label="Meta">
        <div>
          <div class="mono">${escapeHtml(meta || "—")}</div>
          <div class="rowSub mono">ID: ${escapeHtml(it.id)}</div>
        </div>
      </td>

      <td data-label="File">
        <div>${fileCell}</div>
      </td>

      <td data-label="Actions">
        <div class="actions">
          ${viewBtn}
          <button class="miniBtn" data-act="edit" data-id="${it.id}">Edit</button>
          <button class="miniBtn" data-act="rename" data-id="${it.id}">Rename</button>
          <button class="miniBtn danger" data-act="delete" data-id="${it.id}">Delete</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.getAttribute("data-act");
      const id = Number(btn.getAttribute("data-id"));
      const item = currentItems.find((x) => Number(x.id) === id);
      if (!item) return;

      if (act === "view") openView(item);
      if (act === "edit") openEdit(item);
      if (act === "rename") openRename(item);
      if (act === "delete") await doDelete(item);
    });
  });
}

async function loadList() {
  if (listLoading) return;
  try {
    setListLoading(true);
    renderLoadingRow();

    const qs = new URLSearchParams();
    qs.set("limit", "400");

    const q = safeStr(qEl?.value);
    if (q) qs.set("q", q);

    const lv = safeStr(fLevel?.value);
    const sem = safeStr(fSemester?.value);
    const tp = safeStr(fType?.value);

    if (lv) qs.set("level", lv);
    if (sem) qs.set("semester", sem);
    if (tp) qs.set("type", tp);

    const data = await apiFetch(`/pastquestions/list.php?${qs.toString()}`, { method: "GET" });
    currentItems = Array.isArray(data?.items) ? data.items : [];
    renderTable(currentItems);
  } catch (e) {
    toast(e.message || "Failed to load list.", "bad");
  } finally {
    setListLoading(false);
  }
}

/* ---------- EDIT MODAL ---------- */
const editOverlay = $("editOverlay");
const btnEditClose = $("btnEditClose");
const btnEditSave = $("btnEditSave");

const edit_id = $("edit_id");
const edit_title = $("edit_title");
const edit_course_code = $("edit_course_code");
const edit_course_title = $("edit_course_title");
const edit_level = $("edit_level");
const edit_semester = $("edit_semester");
const edit_type = $("edit_type");
const edit_session = $("edit_session");
const edit_notes = $("edit_notes");

function openEdit(it) {
  if (!editOverlay) return;

  lastFocusEl = document.activeElement;

  edit_id.value = it.id;
  edit_title.value = safeStr(it.title);
  edit_course_code.value = safeStr(it.course_code);
  edit_course_title.value = safeStr(it.course_title);
  edit_level.value = safeStr(it.level);
  edit_semester.value = safeStr(it.semester);
  edit_type.value = safeStr(it.type) || "Exam";
  edit_session.value = safeStr(it.session);
  edit_notes.value = safeStr(it.notes);

  editOverlay.classList.add("open");
  edit_title?.focus();
}
function closeEdit() {
  editOverlay?.classList.remove("open");
  if (lastFocusEl && typeof lastFocusEl.focus === "function") lastFocusEl.focus();
  lastFocusEl = null;
}

async function saveEdit() {
  const ok = await checkAuth();
  if (!ok) return toast("Login first.", "warn");

  const id = Number(edit_id.value);
  if (!id) return toast("Invalid item id.", "bad");

  const payload = {
    id,
    title: safeStr(edit_title.value),
    course_code: safeStr(edit_course_code.value),
    course_title: safeStr(edit_course_title.value),
    level: safeStr(edit_level.value),
    semester: safeStr(edit_semester.value),
    type: safeStr(edit_type.value),
    session: safeStr(edit_session.value),
    year: "",
    notes: safeStr(edit_notes.value),
  };

  try {
    btnEditSave.disabled = true;
    const data = await apiFetch("/pastquestions/update.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!data?.success) throw new Error(data?.error || "Update failed.");
    toast("Updated ✅", "ok");
    closeEdit();
    await loadList();
  } catch (e) {
    toast(e.message || "Update failed.", "bad");
  } finally {
    btnEditSave.disabled = false;
  }
}

/* ---------- RENAME MODAL ---------- */
const renameOverlay = $("renameOverlay");
const btnRenameClose = $("btnRenameClose");
const btnRenameDo = $("btnRenameDo");
const rename_id = $("rename_id");
const rename_safe = $("rename_safe");

function openRename(it) {
  if (!renameOverlay) return;

  lastFocusEl = document.activeElement;

  rename_id.value = it.id;
  rename_safe.value = fileBaseFromItem(it);
  renameOverlay.classList.add("open");
  rename_safe?.focus();
}
function closeRename() {
  renameOverlay?.classList.remove("open");
  if (lastFocusEl && typeof lastFocusEl.focus === "function") lastFocusEl.focus();
  lastFocusEl = null;
}

async function doRename() {
  const ok = await checkAuth();
  if (!ok) return toast("Login first.", "warn");

  const id = Number(rename_id.value);
  const safe_name = toKebab(rename_safe.value);
  if (!id || !safe_name) return toast("Enter a valid name.", "warn");

  try {
    btnRenameDo.disabled = true;
    const data = await apiFetch("/pastquestions/rename.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, safe_name }),
    });
    if (!data?.success) throw new Error(data?.error || "Rename failed.");
    toast("Renamed ✅", "ok");
    closeRename();
    await loadList();
  } catch (e) {
    toast(e.message || "Rename failed.", "bad");
  } finally {
    btnRenameDo.disabled = false;
  }
}

/* ---------- DELETE ---------- */
async function doDelete(it) {
  const ok = await checkAuth();
  if (!ok) return toast("Login first.", "warn");

  const sure = confirm(
    `Delete this past question?\n\n${safeStr(it.title) || "Untitled"}\n(ID: ${it.id})\n\nThis will remove it from DB and delete the uploaded file.`
  );
  if (!sure) return;

  try {
    const data = await apiFetch("/pastquestions/delete.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(it.id) }),
    });
    if (!data?.success) throw new Error(data?.error || "Delete failed.");
    toast("Deleted ✅", "ok");
    await loadList();
  } catch (e) {
    toast(e.message || "Delete failed.", "bad");
  }
}

/* ---------- WIRE UP ---------- */
function bind() {
  btnLogin?.addEventListener("click", login);
  btnLogout?.addEventListener("click", logout);

  btnRefresh?.addEventListener("click", loadList);
  btnRefreshTop?.addEventListener("click", loadList);

  qEl?.addEventListener("input", () => {
    window.clearTimeout(bind._t);
    bind._t = window.setTimeout(loadList, 250);
  });
  fLevel?.addEventListener("change", loadList);
  fSemester?.addEventListener("change", loadList);
  fType?.addEventListener("change", loadList);

  // upload
  btnUpload?.addEventListener("click", uploadNow);
  btnClearUpload?.addEventListener("click", () => {
    clearUploadForm();
    toast("Cleared.", "ok");
  });

  // local preview
  fileEl?.addEventListener("change", () => {
    const f = fileEl?.files?.[0];
    if (!f) return clearLocalPreview();
    if (localPreviewName) localPreviewName.textContent = f.name;
    showLocalPreviewForFile(f);
  });
  btnPreviewLocal?.addEventListener("click", () => {
    const f = fileEl?.files?.[0];
    if (!f) return toast("Select a file first.", "warn");
    showLocalPreviewForFile(f);
  });
  btnCloseLocalPreview?.addEventListener("click", clearLocalPreview);

  // edit modal
  btnEditClose?.addEventListener("click", closeEdit);
  btnEditSave?.addEventListener("click", saveEdit);
  editOverlay?.addEventListener("click", (e) => {
    if (e.target === editOverlay) closeEdit();
  });

  // rename modal
  btnRenameClose?.addEventListener("click", closeRename);
  btnRenameDo?.addEventListener("click", doRename);
  renameOverlay?.addEventListener("click", (e) => {
    if (e.target === renameOverlay) closeRename();
  });

  // view modal
  btnViewClose?.addEventListener("click", closeView);
  viewOverlay?.addEventListener("click", (e) => {
    if (e.target === viewOverlay) closeView();
  });

  // escape closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeView();
    closeEdit();
    closeRename();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initMobileNav();
  bind();
  await checkAuth();
  await loadList();
});