const STORAGE_KEY = "minimal_todo_v1";

const $ = (sel) => document.querySelector(sel);
const todoForm = $("#todoForm");
const todoInput = $("#todoInput");
const todoList = $("#todoList");
const stats = $("#stats");
const resetBtn = $("#resetBtn");
const clearDoneBtn = $("#clearDoneBtn");
const searchInput = $("#searchInput");
const exportBtn = $("#exportBtn");

let state = {
  todos: [],
  filter: "all", // all | active | done
  q: "",
};

function uid() {
  // 小而夠用的唯一值
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.todos)) {
      state.todos = parsed.todos;
    }
  } catch (_) {
    // ignore
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ todos: state.todos }));
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function filteredTodos() {
  const q = state.q.trim().toLowerCase();
  return state.todos.filter((t) => {
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "active" && !t.done) ||
      (state.filter === "done" && t.done);

    const matchesQuery = !q || t.text.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });
}

function render() {
  const list = filteredTodos();

  todoList.innerHTML = list.length
    ? list.map(renderItem).join("")
    : `<li class="muted" style="padding:12px 10px;">目前沒有符合的待辦。</li>`;

  const total = state.todos.length;
  const done = state.todos.filter((t) => t.done).length;
  const active = total - done;
  stats.textContent = `${total} 項（進行中 ${active} / 已完成 ${done}）`;

  wireItemEvents();
}

function renderItem(t) {
  const checkedIcon = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  return `
    <li class="item ${t.done ? "done" : ""}" data-id="${t.id}">
      <button class="check" type="button" aria-label="toggle done">
        ${checkedIcon}
      </button>

      <div class="text" tabindex="0" title="雙擊可編輯">
        ${escapeHtml(t.text)}
      </div>

      <button class="del" type="button" aria-label="delete">✕</button>
    </li>
  `;
}

function addTodo(text) {
  state.todos.unshift({
    id: uid(),
    text: text.trim(),
    done: false,
    createdAt: Date.now(),
  });
  save();
  render();
}

function toggleTodo(id) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save();
  render();
}

function deleteTodo(id) {
  state.todos = state.todos.filter((x) => x.id !== id);
  save();
  render();
}

function clearDone() {
  const before = state.todos.length;
  state.todos = state.todos.filter((t) => !t.done);
  if (state.todos.length !== before) {
    save();
    render();
  }
}

function resetAll() {
  if (!confirm("確定要刪除全部待辦嗎？這個動作無法復原。")) return;
  state.todos = [];
  save();
  render();
}

function setFilter(next) {
  state.filter = next;
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.filter === next);
  });
  render();
}

function startEdit(li) {
  const textEl = li.querySelector(".text");
  const id = li.dataset.id;
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;

  const original = t.text;
  textEl.setAttribute("contenteditable", "true");
  textEl.focus();

  // 把游標移到最後
  const range = document.createRange();
  range.selectNodeContents(textEl);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function finish(saveIt) {
    textEl.removeEventListener("keydown", onKey);
    textEl.removeEventListener("blur", onBlur);
    textEl.setAttribute("contenteditable", "false");

    if (!saveIt) {
      textEl.textContent = original;
      return;
    }

    const next = textEl.textContent.trim();
    if (!next) {
      // 空白就刪除
      deleteTodo(id);
      return;
    }
    t.text = next;
    save();
    render();
  }

  function onKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
  }

  function onBlur() {
    finish(true);
  }

  textEl.addEventListener("keydown", onKey);
  textEl.addEventListener("blur", onBlur);
}

function wireItemEvents() {
  todoList.querySelectorAll(".item").forEach((li) => {
    const id = li.dataset.id;

    li.querySelector(".check").addEventListener("click", () => toggleTodo(id));
    li.querySelector(".del").addEventListener("click", () => deleteTodo(id));

    const textEl = li.querySelector(".text");
    textEl.addEventListener("dblclick", () => startEdit(li));
  });
}

// 匯出 JSON（備份）
function exportJson() {
  const blob = new Blob([JSON.stringify({ todos: state.todos }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "todo-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Events ----------
todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;
  addTodo(text);
  todoInput.value = "";
  todoInput.focus();
});

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

searchInput.addEventListener("input", () => {
  state.q = searchInput.value;
  render();
});

clearDoneBtn.addEventListener("click", clearDone);
resetBtn.addEventListener("click", resetAll);
exportBtn.addEventListener("click", exportJson);

// ---------- Init ----------
load();
render();
