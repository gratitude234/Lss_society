/* pastquestions/admin.js
   Supabase Admin (Auth + Storage + Table)
   - Email/password login (Supabase Auth)
   - Upload file to Storage bucket: pastquestions
   - Insert/Update/Delete metadata in public.past_questions
   - Rename (Storage move + update file_path)
*/

const SUPABASE = window.__SUPABASE__ || { url: "", anonKey: "", bucket: "pastquestions" };
const sb = window.sb;

// ---------- DOM helpers ----------
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
function escapeHtml(s) {
  return safeStr(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function toKebab(s) {
  return safeStr(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function isPdfName(nameOrUrl = "") {
  return /\.pdf(\?|#|$)/i.test(nameOrUrl);
}
function isImageName(nameOrUrl = "") {
  return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(nameOrUrl);
}
function publicFileUrl(filePath) {
  if (window.__supabasePublicFileUrl__) return window.__supabasePublicFileUrl__(filePath);
  if (!filePath) return "";
  return `${SUPABASE.url}/storage/v1/object/public/${SUPABASE.bucket}/${encodeURI(filePath)}`;
}

// ---------- Elements ----------
const authPill = $("authPill");
const btnLogout = $("btnLogout");
const btnLogin = $("btnLogin");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");

const btnRefreshTop = $("btnRefreshTop");

const fileEl = $("file");
const btnPreviewLocal = $("btnPreviewLocal");
const btnCloseLocalPreview = $("btnCloseLocalPreview");
const localPreviewName = $("localPreviewName");
const localPreviewWrap = $("localPreviewWrap");
const localPreviewPdf = $("localPreviewPdf");
const localPreviewImg = $("localPreviewImg");

const course_code = $("course_code");
const course_title = $("course_title");
const titleEl = $("title");
const levelEl = $("level");
const semesterEl = $("semester");
const typeEl = $("type");
const sessionEl = $("session");
const notesEl = $("notes");
const safeNameEl = $("safe_name");

const btnUpload = $("btnUpload");
const btnClearUpload = $("btnClearUpload");

const countPill = $("countPill");
const qEl = $("q");
const fLevel = $("fLevel");
const fSemester = $("fSemester");
const fType = $("fType");
const btnRefresh = $("btnRefresh");
const tbody = $("tbody");

// View modal
const viewOverlay = $("viewOverlay");
const btnViewClose = $("btnViewClose");
const viewTitle = $("viewTitle");
const viewMeta = $("viewMeta");
const viewOpen = $("viewOpen");
const viewPdf = $("viewPdf");
const viewImg = $("viewImg");

// Edit modal
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

// ---------- State ----------
let currentItems = [];

// ---------- Auth ----------
async function refreshAuthUI() {
  try {
    if (!sb) {
      authPill.textContent = "Supabase not loaded";
      authPill.className = "pill warn";
      return;
    }
    const { data } = await sb.auth.getSession();
    const session = data?.session;
    if (session?.user) {
      const email = session.user.email || "Signed in";
      authPill.textContent = email;
      authPill.className = "pill ok";
      btnLogout.style.display = "inline-flex";
    } else {
      authPill.textContent = "Not signed in";
      authPill.className = "pill warn";
      btnLogout.style.display = "none";
    }
  } catch (e) {
    authPill.textContent = "Auth error";
    authPill.className = "pill bad";
  }
}

async function login() {
  const email = safeStr(loginEmail?.value);
  const password = String(loginPassword?.value || "");
  if (!email || !password) return toast("Email + password required.", "warn");
  try {
    btnLogin.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    toast("Signed in ✅", "ok");
    loginPassword.value = "";
    await refreshAuthUI();
    await loadList();
  } catch (e) {
    toast(e?.message || "Login failed.", "bad");
  } finally {
    btnLogin.disabled = false;
  }
}

async function logout() {
  try {
    await sb.auth.signOut();
    toast("Logged out.", "ok");
    await refreshAuthUI();
  } catch (e) {
    toast(e?.message || "Logout failed.", "bad");
  }
}

// ---------- Local preview ----------
function clearLocalPreview() {
  if (!localPreviewWrap) return;
  localPreviewWrap.style.display = "none";
  if (localPreviewPdf) localPreviewPdf.style.display = "none";
  if (localPreviewImg) localPreviewImg.style.display = "none";
  if (localPreviewPdf) localPreviewPdf.src = "";
  if (localPreviewImg) localPreviewImg.src = "";
  if (localPreviewName) localPreviewName.textContent = "";
}

function showLocalPreview(file) {
  if (!file || !localPreviewWrap) return;
  const url = URL.createObjectURL(file);
  if (localPreviewName) localPreviewName.textContent = file.name;

  if (isPdfName(file.name)) {
    localPreviewPdf.style.display = "block";
    localPreviewImg.style.display = "none";
    localPreviewPdf.src = url;
  } else if (isImageName(file.name)) {
    localPreviewImg.style.display = "block";
    localPreviewPdf.style.display = "none";
    localPreviewImg.src = url;
  } else {
    toast("Preview supports PDF/images only.", "warn");
    URL.revokeObjectURL(url);
    return;
  }
  localPreviewWrap.style.display = "block";
}

// ---------- Upload ----------
function buildFilePathFromForm(file) {
  const ext = (file?.name?.split(".").pop() || "pdf").toLowerCase();

  // If user typed safe_name, respect it (and keep folder 'all/')
  const typed = toKebab(safeNameEl?.value || "");
  if (typed) return `all/${typed}.${ext}`;

  const code = toKebab(course_code?.value || "course");
  const lv = toKebab(levelEl?.value || "");
  const sem = toKebab(semesterEl?.value || "");
  const tp = toKebab(typeEl?.value || "");
  const sess = toKebab(sessionEl?.value || "");
  const base = [code, lv, sem, tp, sess].filter(Boolean).join("-");
  return `all/${base || "past-question"}.${ext}`;
}

function readMetaFromForm() {
  return {
    title: safeStr(titleEl?.value),
    course_code: safeStr(course_code?.value),
    course_title: safeStr(course_title?.value),
    level: safeStr(levelEl?.value),
    semester: safeStr(semesterEl?.value),
    type: safeStr(typeEl?.value),
    session: safeStr(sessionEl?.value),
    notes: safeStr(notesEl?.value),
  };
}

async function uploadNew() {
  const file = fileEl?.files?.[0];
  if (!file) return toast("Choose a file first.", "warn");

  const meta = readMetaFromForm();
  if (!meta.title) return toast("Title is required.", "warn");

  try {
    btnUpload.disabled = true;

    // Ensure signed in
    const { data } = await sb.auth.getSession();
    if (!data?.session?.user) {
      toast("Please sign in first.", "warn");
      return;
    }

    const filePath = buildFilePathFromForm(file);

    // Upload (upsert allowed)
    const up = await sb.storage.from(SUPABASE.bucket).upload(filePath, file, {
      upsert: true,
      contentType: file.type || "application/pdf",
    });
    if (up.error) throw up.error;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const format = ext === "pdf" ? "pdf" : (isImageName(file.name) ? "image" : ext);

    // Insert metadata
    const ins = await sb.from("past_questions").insert([{
      ...meta,
      format,
      file_path: filePath,
    }]);
    if (ins.error) throw ins.error;

    toast("Uploaded ✅", "ok");
    clearUploadForm();
    await loadList();
  } catch (e) {
    toast(e?.message || "Upload failed.", "bad");
  } finally {
    btnUpload.disabled = false;
  }
}

function clearUploadForm() {
  if (fileEl) fileEl.value = "";
  if (titleEl) titleEl.value = "";
  if (course_code) course_code.value = "";
  if (course_title) course_title.value = "";
  if (levelEl) levelEl.value = "";
  if (semesterEl) semesterEl.value = "";
  if (typeEl) typeEl.value = "";
  if (sessionEl) sessionEl.value = "";
  if (notesEl) notesEl.value = "";
  if (safeNameEl) safeNameEl.value = "";
  clearLocalPreview();
}

// ---------- List / Filters ----------
async function loadList() {
  try {
    const q = safeStr(qEl?.value);
    const lv = safeStr(fLevel?.value);
    const sem = safeStr(fSemester?.value);
    const tp = safeStr(fType?.value);

    let query = sb.from("past_questions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(400);

    if (lv) query = query.eq("level", lv);
    if (sem) query = query.eq("semester", sem);
    if (tp) query = query.eq("type", tp);

    if (q) {
      // Escape commas because .or() uses commas as separators
      const qq = q.replaceAll(",", " ");
      query = query.or(
        `title.ilike.%${qq}%,course_code.ilike.%${qq}%,course_title.ilike.%${qq}%,session.ilike.%${qq}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    currentItems = (data || []).map((row) => ({
      ...row,
      file_url: publicFileUrl(row.file_path),
    }));

    renderTable(currentItems);
  } catch (e) {
    toast(e?.message || "Failed to load list.", "bad");
  }
}

function renderTable(items) {
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="mono">No items found.</td>`;
    tbody.appendChild(tr);
    if (countPill) countPill.textContent = "0 items";
    return;
  }

  if (countPill) countPill.textContent = `${items.length} item(s)`;

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
      ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener" class="mono" style="color:rgba(234,240,255,.88); text-decoration:underline;">Open</a>
         <div class="rowSub mono">${escapeHtml(fileUrl.split("/").pop() || "")}</div>`
      : `<span class="mono">—</span>`;

    const viewBtn = fileUrl
      ? `<button class="miniBtn" data-act="view" data-id="${it.id}">View</button>`
      : `<button class="miniBtn" disabled title="No file available">View</button>`;

    tr.innerHTML = `
      <td>
        <div class="rowTitle">${escapeHtml(title)}</div>
        ${course ? `<div class="rowSub">${escapeHtml(course)}</div>` : `<div class="rowSub">—</div>`}
      </td>
      <td>
        <div class="mono">${escapeHtml(meta || "—")}</div>
        <div class="rowSub mono">ID: ${escapeHtml(it.id)}</div>
      </td>
      <td>${fileCell}</td>
      <td>
        <div class="rowActions">
          ${viewBtn}
          <button class="miniBtn" data-act="edit" data-id="${it.id}">Edit</button>
          <button class="miniBtn" data-act="rename" data-id="${it.id}">Rename</button>
          <button class="miniBtn danger" data-act="delete" data-id="${it.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// ---------- View modal ----------
function openView(item) {
  if (!item) return;
  const fileUrl = safeStr(item.file_url || "");
  if (!fileUrl) return toast("No file URL.", "warn");

  viewTitle.textContent = safeStr(item.title) || "Preview";
  viewMeta.textContent = [safeStr(item.course_code), safeStr(item.level), safeStr(item.semester), safeStr(item.session)]
    .filter(Boolean)
    .join(" • ");

  viewOpen.href = fileUrl;

  // reset
  viewPdf.style.display = "none";
  viewImg.style.display = "none";
  viewPdf.src = "";
  viewImg.src = "";

  if (isPdfName(fileUrl)) {
    viewPdf.style.display = "block";
    viewPdf.src = fileUrl;
  } else if (isImageName(fileUrl)) {
    viewImg.style.display = "block";
    viewImg.src = fileUrl;
  } else {
    // fallback
    viewPdf.style.display = "block";
    viewPdf.src = fileUrl;
  }

  viewOverlay.setAttribute("aria-hidden", "false");
  viewOverlay.classList.add("show");
}
function closeView() {
  viewOverlay.setAttribute("aria-hidden", "true");
  viewOverlay.classList.remove("show");
  viewPdf.src = "";
  viewImg.src = "";
}

// ---------- Edit modal ----------
function openEdit(item) {
  if (!item) return;
  edit_id.value = item.id;
  edit_title.value = safeStr(item.title);
  edit_course_code.value = safeStr(item.course_code);
  edit_course_title.value = safeStr(item.course_title);
  edit_level.value = safeStr(item.level);
  edit_semester.value = safeStr(item.semester);
  edit_type.value = safeStr(item.type);
  edit_session.value = safeStr(item.session);
  edit_notes.value = safeStr(item.notes);

  editOverlay.setAttribute("aria-hidden", "false");
  editOverlay.classList.add("show");
}
function closeEdit() {
  editOverlay.setAttribute("aria-hidden", "true");
  editOverlay.classList.remove("show");
}

async function saveEdit() {
  const id = safeStr(edit_id.value);
  if (!id) return;

  const payload = {
    title: safeStr(edit_title.value),
    course_code: safeStr(edit_course_code.value),
    course_title: safeStr(edit_course_title.value),
    level: safeStr(edit_level.value),
    semester: safeStr(edit_semester.value),
    type: safeStr(edit_type.value),
    session: safeStr(edit_session.value),
    notes: safeStr(edit_notes.value),
  };

  try {
    btnEditSave.disabled = true;

    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session?.user) {
      toast("Please sign in first.", "warn");
      return;
    }

    const { error } = await sb.from("past_questions").update(payload).eq("id", id);
    if (error) throw error;

    toast("Saved ✅", "ok");
    closeEdit();
    await loadList();
  } catch (e) {
    toast(e?.message || "Save failed.", "bad");
  } finally {
    btnEditSave.disabled = false;
  }
}

// ---------- Rename (Storage move + update file_path) ----------
async function renameItem(item) {
  if (!item) return;

  const current = safeStr(item.file_path);
  if (!current) return toast("No file_path for this item.", "warn");

  const currentName = current.split("/").pop() || current;
  const nextBase = prompt(
    "New file name (no extension). Example: lss101-first-semester-exam-2024-2025\n\nCurrent: " + currentName,
    currentName.replace(/\.[^.]+$/, "")
  );
  if (!nextBase) return;

  const ext = (currentName.split(".").pop() || "pdf").toLowerCase();
  const next = `all/${toKebab(nextBase)}.${ext}`;

  if (next === current) return;

  try {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session?.user) {
      toast("Please sign in first.", "warn");
      return;
    }

    // Move in storage
    const mv = await sb.storage.from(SUPABASE.bucket).move(current, next);
    if (mv.error) throw mv.error;

    // Update row
    const { error } = await sb.from("past_questions").update({ file_path: next }).eq("id", item.id);
    if (error) throw error;

    toast("Renamed ✅", "ok");
    await loadList();
  } catch (e) {
    toast(e?.message || "Rename failed.", "bad");
  }
}

// ---------- Delete ----------
async function deleteItem(item) {
  if (!item) return;
  if (!confirm(`Delete this item?\n\n${safeStr(item.title) || item.id}`)) return;

  try {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session?.user) {
      toast("Please sign in first.", "warn");
      return;
    }

    // Delete storage object if present
    const fp = safeStr(item.file_path);
    if (fp) {
      const rm = await sb.storage.from(SUPABASE.bucket).remove([fp]);
      if (rm.error) throw rm.error;
    }

    const { error } = await sb.from("past_questions").delete().eq("id", item.id);
    if (error) throw error;

    toast("Deleted ✅", "ok");
    await loadList();
  } catch (e) {
    toast(e?.message || "Delete failed.", "bad");
  }
}

// ---------- Events ----------
function wireEvents() {
  // Auth
  btnLogin?.addEventListener("click", (e) => { e.preventDefault(); login(); });
  btnLogout?.addEventListener("click", (e) => { e.preventDefault(); logout(); });

  // Upload
  btnUpload?.addEventListener("click", (e) => { e.preventDefault(); uploadNew(); });
  btnClearUpload?.addEventListener("click", (e) => { e.preventDefault(); clearUploadForm(); });

  fileEl?.addEventListener("change", () => {
    clearLocalPreview();
    const file = fileEl.files?.[0];
    if (file) showLocalPreview(file);
  });

  btnPreviewLocal?.addEventListener("click", (e) => {
    e.preventDefault();
    const file = fileEl.files?.[0];
    if (!file) return toast("Choose a file first.", "warn");
    showLocalPreview(file);
  });
  btnCloseLocalPreview?.addEventListener("click", (e) => {
    e.preventDefault();
    clearLocalPreview();
  });

  // List / filters
  btnRefreshTop?.addEventListener("click", (e) => { e.preventDefault(); loadList(); });
  btnRefresh?.addEventListener("click", (e) => { e.preventDefault(); loadList(); });
  qEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadList();
  });
  fLevel?.addEventListener("change", () => loadList());
  fSemester?.addEventListener("change", () => loadList());
  fType?.addEventListener("change", () => loadList());

  // Table actions (event delegation)
  tbody?.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    if (!act || !id) return;

    const item = currentItems.find((x) => String(x.id) === String(id));
    if (!item) return;

    if (act === "view") return openView(item);
    if (act === "edit") return openEdit(item);
    if (act === "rename") return renameItem(item);
    if (act === "delete") return deleteItem(item);
  });

  // View modal
  btnViewClose?.addEventListener("click", (e) => { e.preventDefault(); closeView(); });
  viewOverlay?.addEventListener("click", (e) => {
    if (e.target === viewOverlay) closeView();
  });

  // Edit modal
  btnEditClose?.addEventListener("click", (e) => { e.preventDefault(); closeEdit(); });
  btnEditSave?.addEventListener("click", (e) => { e.preventDefault(); saveEdit(); });
  editOverlay?.addEventListener("click", (e) => {
    if (e.target === editOverlay) closeEdit();
  });
}

async function init() {
  $("year").textContent = String(new Date().getFullYear());

  if (!sb) {
    toast("Supabase not loaded. Check admin.html script tags.", "bad");
    return;
  }

  wireEvents();
  await refreshAuthUI();

  // React to auth changes
  sb.auth.onAuthStateChange(() => {
    refreshAuthUI();
  });

  // Load list (public read)
  await loadList();
}

document.addEventListener("DOMContentLoaded", init);
