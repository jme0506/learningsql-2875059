const SAVE_KEY = "malfoid.saveId";

const STARTERS = [
  { label: "Bump into her in the library", text: "*I'm reaching for the same book as you in the Restricted Section.* Oh— sorry, I didn't see you there." },
  { label: "Sit next to her in Potions", text: "*I drop my bag on the bench next to yours in Potions.* Mind if I sit here? Slughorn says we're pairing up." },
  { label: "Ask about Quidditch", text: "Are you playing in the next match? I heard you've been skipping practice." },
  { label: "Ask her to Hogsmeade", text: "So… there's a Hogsmeade weekend coming up. Want to go to Honeydukes with me?" },
  { label: "Catch her near the Room of Requirement", text: "*I spot you slipping out of a door on the seventh floor that definitely wasn't there a minute ago.* Malfoy? What were you doing in there?" },
  { label: "Gossip about Potter", text: "Have you noticed Potter staring at you across the Great Hall all week?" },
];

const $ = (sel) => document.querySelector(sel);
let state = null;
let busy = false;

function getSavedId() {
  try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
}
function setSavedId(id) {
  try { id ? localStorage.setItem(SAVE_KEY, id) : localStorage.removeItem(SAVE_KEY); } catch {}
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Tiny markdown: **bold** and *italics* only.
function render(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function addMessage(role, text, opts = {}) {
  const el = document.createElement("div");
  el.className = `msg ${role}${opts.ooc ? " ooc" : ""}${opts.typing ? " typing" : ""}`;
  el.innerHTML = render(text);
  $("#messages").append(el);
  scrollDown();
  return el;
}

function scrollDown() {
  const box = $("#messages");
  box.scrollTop = box.scrollHeight;
}

function applyState(s) {
  state = s;
  $("#mood").textContent = s.mood;
  $("#tier").textContent = s.tier;
  $("#affection-bar").style.width = `${s.affection}%`;
  $("#portrait").className = `portrait ${s.mood.toLowerCase()}`;
  $("#scene").value = s.scene;
  $("#date").textContent = formatDate(s.inWorldDate);
  $("#light-mode").checked = s.storyMode === "light";
  $("#save-id").textContent = s.id;
}

function renderHistory() {
  $("#messages").innerHTML = "";
  for (const m of state.messages) addMessage(m.role, m.content, { ooc: m.ooc });
}

function renderStarters() {
  const box = $("#starters");
  box.innerHTML = "";
  for (const s of STARTERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.label;
    b.addEventListener("click", () => { $("#input").value = s.text; autoGrow(); $("#input").focus(); });
    box.append(b);
  }
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

async function chat(body) {
  busy = true;
  $("#send").disabled = true;
  const bubble = addMessage("assistant", "Malfoid is writing… (and crossing it out)", { typing: true });
  let text = "";
  let started = false;

  try {
    const res = await fetch(`/api/saves/${state.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const evt = JSON.parse(line);
        if (evt.type === "text") {
          if (!started) { started = true; bubble.classList.remove("typing"); }
          text += evt.text;
          bubble.innerHTML = render(text);
          scrollDown();
        } else if (evt.type === "done") {
          const last = evt.state.messages.at(-1);
          if (last?.ooc) bubble.classList.add("ooc");
          applyState(evt.state);
        } else if (evt.type === "error") {
          bubble.remove();
          addMessage("system", evt.error);
        }
      }
    }
  } catch (err) {
    bubble.remove();
    addMessage("system", `Something went wrong: ${err.message}`);
  } finally {
    busy = false;
    $("#send").disabled = false;
  }
}

function autoGrow() {
  const t = $("#input");
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
}

async function showChat(s) {
  applyState(s);
  $("#onboarding").hidden = true;
  $("#chat").hidden = false;
  renderHistory();
  renderStarters();
  if (s.messages.length === 0) await chat({ start: true });
  $("#input").focus();
}

async function init() {
  const meta = await api("/api/meta");
  $("#scene").innerHTML = meta.scenes.map((s) => `<option>${escapeHtml(s)}</option>`).join("");

  const id = getSavedId();
  if (id) {
    try { return await showChat(await api(`/api/saves/${id}`)); } catch { setSavedId(null); }
  }
  $("#onboarding").hidden = false;
}

$("#onboard-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    const s = await api("/api/saves", { method: "POST", body: data });
    setSavedId(s.id);
    await showChat(s);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

$("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#input").value.trim();
  if (!text || busy) return;
  addMessage("user", text);
  $("#input").value = "";
  autoGrow();
  chat({ message: text });
});

$("#input").addEventListener("input", autoGrow);
$("#input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#composer").requestSubmit();
  }
});

$("#scene").addEventListener("change", async (e) => {
  const s = await api(`/api/saves/${state.id}`, { method: "PATCH", body: { scene: e.target.value } });
  applyState(s);
  addMessage("system", `— You head to the ${s.scene}. —`);
});

$("#settings-btn").addEventListener("click", () => $("#settings").showModal());

$("#light-mode").addEventListener("change", async (e) => {
  const s = await api(`/api/saves/${state.id}`, {
    method: "PATCH",
    body: { storyMode: e.target.checked ? "light" : "canon" },
  });
  applyState(s);
});

$("#new-save").addEventListener("click", () => {
  if (!confirm("Start over with a new character? Your current save stays on disk but you'll leave it.")) return;
  setSavedId(null);
  location.reload();
});

init();
