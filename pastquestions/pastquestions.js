// pastquestions.js
(async function () {
  const $ = (id) => document.getElementById(id);
  const norm = (v) => String(v || "").toLowerCase().trim();

  async function load() {
    const res = await fetch("/pastquestions/resources.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load /pastquestions/resources.json");
    return await res.json();
  }

  function match(item, f) {
    if (f.level && item.level !== f.level) return false;
    if (f.semester && item.semester !== f.semester) return false;
    if (f.type && item.type !== f.type) return false;

    if (f.q) {
      const blob = [
        item.title,
        item.course_code,
        item.course_title,
        item.session,
        item.type,
        item.level,
        item.semester,
      ].join(" ");
      if (!norm(blob).includes(norm(f.q))) return false;
    }
    return true;
  }

  function tag(text, kind) {
    const span = document.createElement("span");
    span.className = `pq-tag ${kind || ""}`.trim();
    span.textContent = text;
    return span;
  }

  function render(items) {
    const grid = $("grid");
    grid.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "pq-empty";
      empty.innerHTML = `
        <b>No results</b><br/>
        Try removing filters, or search by session like <code>2024/2025</code>.
      `;
      grid.appendChild(empty);
      return;
    }

    for (const it of items) {
      const card = document.createElement("article");
      card.className = "pq-card";

      const titleText =
        it.course_code && it.course_code !== "UNKNOWN"
          ? `${it.course_code} — ${it.course_title || "Past Question"}`
          : (it.title || "Past Question");

      const metaLine = [
        it.session && it.session !== "UNKNOWN" ? it.session : "UNKNOWN",
        it.type || "UNKNOWN",
        (it.format || "").toUpperCase()
      ].filter(Boolean).join(" • ");

      const top = document.createElement("div");
      top.className = "pq-topline";

      const name = document.createElement("h3");
      name.className = "pq-name";
      name.textContent = titleText;

      top.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "pq-meta";
      meta.textContent = metaLine;

      const tags = document.createElement("div");
      tags.className = "pq-tags";

      const lvl = it.level || "UNSORTED";
      const sem = it.semester || "UNSORTED";
      const typ = it.type || "UNKNOWN";

      tags.appendChild(tag(lvl, lvl === "UNSORTED" ? "bad" : "good"));
      tags.appendChild(tag(sem, sem === "UNSORTED" ? "bad" : "good"));
      tags.appendChild(tag(typ, typ === "UNKNOWN" ? "bad" : "good"));

      if (it.course_code && it.course_code !== "UNKNOWN") {
        tags.appendChild(tag(it.course_code, ""));
      }

      const btnRow = document.createElement("div");
      btnRow.className = "pq-btnrow";

      const a = document.createElement("a");
      a.className = "pq-download";
      a.href = it.url;
      a.download = "";
      a.textContent = "Download";

      btnRow.appendChild(a);

      card.appendChild(top);
      card.appendChild(meta);
      card.appendChild(tags);

      if (it.notes) {
        const hint = document.createElement("div");
        hint.className = "pq-hint";
        hint.textContent = it.notes;
        card.appendChild(hint);
      }

      card.appendChild(btnRow);
      grid.appendChild(card);
    }
  }

  function apply(all) {
    const f = {
      level: $("level").value,
      semester: $("semester").value,
      type: $("type").value,
      q: $("q").value,
    };
    const filtered = all.filter((it) => match(it, f));
    $("stats").textContent = `${filtered.length} of ${all.length}`;
    render(filtered);
  }

  function setFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const pLevel = params.get("level");
    const pSemester = params.get("semester");
    const pType = params.get("type");
    const pQ = params.get("q");

    if (pLevel) $("level").value = pLevel;
    if (pSemester) $("semester").value = pSemester;
    if (pType) $("type").value = pType;
    if (pQ) $("q").value = pQ;
  }

  function clearFilters() {
    $("level").value = "";
    $("semester").value = "";
    $("type").value = "";
    $("q").value = "";
  }

  try {
    const all = await load();

    setFromUrlParams();

    ["level", "semester", "type"].forEach((id) =>
      $(id).addEventListener("change", () => apply(all))
    );
    $("q").addEventListener("input", () => apply(all));

    const clearBtn = $("clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearFilters();
        apply(all);
      });
    }

    apply(all);
  } catch (e) {
    $("stats").textContent = "Error";
    $("grid").innerHTML = `<div class="pq-empty"><b>Error:</b> ${String(e.message || e)}</div>`;
  }
})();
