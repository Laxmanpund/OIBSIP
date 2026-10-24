const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const pendingList = document.getElementById("pendingList");
const completedList = document.getElementById("completedList");
const pendingCount = document.getElementById("pendingCount");
const completedCount = document.getElementById("completedCount");
const pendingEmpty = document.getElementById("pendingEmpty");
const completedEmpty = document.getElementById("completedEmpty");
const formMessage = document.getElementById("formMessage");
const currentDate = document.getElementById("currentDate");

const STORAGE_KEY = "taskflow-tasks";

let tasks = loadTasks();

// Show today's date
currentDate.textContent = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
});

// Load saved tasks safely
function loadTasks() {
    try {
        const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!Array.isArray(savedTasks)) return [];

        return savedTasks.filter((task) =>
            task &&
            typeof task.id === "string" &&
            typeof task.text === "string" &&
            typeof task.completed === "boolean" &&
            typeof task.createdAt === "string"
        );
    } catch (error) {
        console.error("Could not load saved tasks:", error);
        return [];
    }
}

// Save tasks in browser storage
function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return true;
    } catch (error) {
        console.error("Could not save tasks:", error);
        formMessage.textContent = "Unable to save tasks in this browser.";
        return false;
    }
}

// Format timestamps
function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Create an element with safe text
function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

// Render pending and completed lists
function renderTasks() {
    pendingList.replaceChildren();
    completedList.replaceChildren();

    const pendingTasks = tasks.filter((task) => !task.completed);
    const completedTasks = tasks.filter((task) => task.completed);

    pendingCount.textContent = `${pendingTasks.length} pending`;
    completedCount.textContent = `${completedTasks.length} completed`;

    pendingEmpty.hidden = pendingTasks.length > 0;
    completedEmpty.hidden = completedTasks.length > 0;

    pendingTasks.forEach((task) => {
        pendingList.appendChild(createTaskElement(task));
    });

    completedTasks.forEach((task) => {
        completedList.appendChild(createTaskElement(task));
    });
}

// Build an individual task item
function createTaskElement(task) {
    const item = createElement("li", "task-item");
    const checkbox = createElement("input", "task-checkbox");

    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute(
        "aria-label",
        task.completed ? "Mark task as pending" : "Mark task as complete"
    );
    checkbox.dataset.action = "toggle";
    checkbox.dataset.id = task.id;

    const content = createElement("div", "task-content");
    const taskText = createElement("span", "task-text", task.text);
    const timestamp = createElement(
        "span",
        "task-time",
        `Added: ${formatDate(task.createdAt)}`
    );

    if (task.completed && task.completedAt) {
        timestamp.textContent += ` · Completed: ${formatDate(task.completedAt)}`;
    }

    content.append(taskText, timestamp);

    const actions = createElement("div", "task-actions");

    if (!task.completed) {
        const editButton = createElement("button", "action-button edit-button", "Edit");
        editButton.type = "button";
        editButton.dataset.action = "edit";
        editButton.dataset.id = task.id;
        editButton.setAttribute("aria-label", `Edit ${task.text}`);
        actions.appendChild(editButton);
    }

    const deleteButton = createElement("button", "action-button delete-button", "Delete");
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = task.id;
    deleteButton.setAttribute("aria-label", `Delete ${task.text}`);
    actions.appendChild(deleteButton);

    item.append(checkbox, content, actions);

    return item;
}

// Add a new task
taskForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = taskInput.value.trim();

    if (!text) {
        formMessage.textContent = "Please enter a task first.";
        taskInput.focus();
        return;
    }

    const newTask = {
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null
    };

    tasks.unshift(newTask);

    if (saveTasks()) {
        renderTasks();
        taskInput.value = "";
        formMessage.textContent = "";
        taskInput.focus();
    } else {
        tasks = tasks.filter((task) => task.id !== newTask.id);
    }
});

// Handle checkbox, edit and delete using event delegation
document.addEventListener("change", (event) => {
    const checkbox = event.target;

    if (!checkbox.matches('.task-checkbox[data-action="toggle"]')) return;

    const task = tasks.find((item) => item.id === checkbox.dataset.id);

    if (!task) return;

    const oldCompleted = task.completed;
    const oldCompletedAt = task.completedAt;

    task.completed = checkbox.checked;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    if (!saveTasks()) {
        task.completed = oldCompleted;
        task.completedAt = oldCompletedAt;
    }

    renderTasks();
});

document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const { action, id } = button.dataset;

    if (action === "edit") {
        editTask(id);
    } else if (action === "delete") {
        deleteTask(id);
    }
});

// Edit task text inline
function editTask(id) {
    const task = tasks.find((item) => item.id === id);

    if (!task || task.completed) return;

    const item = pendingList.querySelector(
        `.task-item input[data-id="${CSS.escape(id)}"]`
    )?.closest(".task-item");

    if (!item) return;

    const textElement = item.querySelector(".task-text");
    const content = textElement.parentElement;
    const input = createElement("input", "edit-input");

    input.type = "text";
    input.maxLength = 200;
    input.value = task.text;
    input.setAttribute("aria-label", "Edit task text");

    textElement.replaceWith(input);

    const actions = item.querySelector(".task-actions");
    actions.replaceChildren();

    const saveButton = createElement("button", "action-button edit-button", "Save");
    saveButton.type = "button";

    const cancelButton = createElement("button", "action-button", "Cancel");
    cancelButton.type = "button";

    actions.append(saveButton, cancelButton);

    function finishEdit(save) {
        if (save) {
            const newText = input.value.trim();

            if (!newText) {
                input.setCustomValidity("Task cannot be empty.");
                input.reportValidity();
                input.focus();
                return;
            }

            task.text = newText;
            saveTasks();
        }

        renderTasks();
    }

    saveButton.addEventListener("click", () => finishEdit(true));
    cancelButton.addEventListener("click", () => finishEdit(false));

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") finishEdit(true);
        if (event.key === "Escape") finishEdit(false);
    });

    input.focus();
    input.select();
}

// Delete task permanently
function deleteTask(id) {
    const index = tasks.findIndex((task) => task.id === id);

    if (index === -1) return;

    const removedTask = tasks[index];

    tasks.splice(index, 1);

    if (saveTasks()) {
        renderTasks();
    } else {
        tasks.splice(index, 0, removedTask);
        renderTasks();
    }
}

// Initial render
renderTasks();