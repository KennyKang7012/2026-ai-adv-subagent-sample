const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');

const API = '/api/todos';

// 讀取所有待辦事項並渲染
async function loadTodos() {
  const res = await fetch(API);
  const todos = await res.json();
  render(todos);
}

// 渲染整份清單
function render(todos) {
  list.innerHTML = '';
  emptyState.hidden = todos.length > 0;

  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' completed' : '');
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = todo.title;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.setAttribute('aria-label', '刪除');
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    li.append(checkbox, title, deleteBtn);
    list.appendChild(li);
  }
}

// 新增待辦事項
async function addTodo(title) {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  await loadTodos();
}

// 切換完成狀態
async function toggleTodo(id, completed) {
  await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  await loadTodos();
}

// 刪除待辦事項
async function deleteTodo(id) {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  await loadTodos();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  input.value = '';
  await addTodo(title);
  input.focus();
});

// 頁面載入時取得資料
loadTodos();
