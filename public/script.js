class TodoApp {
    constructor() {
        this.todos = [];
        this.currentEditId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTodos();
        this.setDefaultDates();
    }

    bindEvents() {
        // Modal events
        document.getElementById('addTodoBtn').addEventListener('click', () => this.openModal());
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('todoForm').addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('todoModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        
        document.getElementById('startDate').value = today;
        document.getElementById('dueDate').value = tomorrow;
    }

    async loadTodos() {
        try {
            const response = await fetch('/api/todos');
            if (response.ok) {
                this.todos = await response.json();
                this.renderTodos();
            } else {
                this.showError('Failed to load todos');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    renderTodos() {
        const todoList = document.getElementById('todoList');
        
        if (this.todos.length === 0) {
            todoList.innerHTML = `
                <div class="empty-state">
                    <h2>📋 No tasks yet!</h2>
                    <p>Click "Add New Task" to get started with your to-do list.</p>
                </div>
            `;
            return;
        }

        todoList.innerHTML = this.todos.map(todo => `
            <div class="todo-card priority-${todo.priority}">
                <div class="todo-header">
                    <h3 class="todo-title">${this.escapeHtml(todo.header)}</h3>
                    <span class="priority-badge priority-${todo.priority}">${todo.priority}</span>
                </div>
                
                <p class="todo-description">${this.escapeHtml(todo.description)}</p>
                
                <div class="status-badge status-${todo.status}">${todo.status.replace('-', ' ')}</div>
                
                <div class="todo-meta">
                    <div class="meta-item">
                        <span class="meta-label">Start Date</span>
                        <span class="meta-value">${this.formatDate(todo.startDate)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Due Date</span>
                        <span class="meta-value">${this.formatDate(todo.dueDate)}</span>
                    </div>
                </div>
                
                <div class="todo-actions">
                    <button class="btn btn-edit" onclick="app.editTodo(${todo.id})">Edit</button>
                    <button class="btn btn-danger" onclick="app.deleteTodo(${todo.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    openModal(todo = null) {
        const modal = document.getElementById('todoModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('todoForm');
        
        this.currentEditId = todo ? todo.id : null;
        modalTitle.textContent = todo ? 'Edit Task' : 'Add New Task';
        
        if (todo) {
            document.getElementById('header').value = todo.header;
            document.getElementById('description').value = todo.description;
            document.getElementById('startDate').value = todo.startDate;
            document.getElementById('dueDate').value = todo.dueDate;
            document.getElementById('priority').value = todo.priority;
            document.getElementById('status').value = todo.status;
        } else {
            form.reset();
            this.setDefaultDates();
        }
        
        modal.style.display = 'block';
        document.getElementById('header').focus();
    }

    closeModal() {
        document.getElementById('todoModal').style.display = 'none';
        this.currentEditId = null;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const todoData = {
            header: formData.get('header'),
            description: formData.get('description'),
            startDate: formData.get('startDate'),
            dueDate: formData.get('dueDate'),
            priority: formData.get('priority'),
            status: formData.get('status')
        };

        try {
            let response;
            if (this.currentEditId) {
                response = await fetch(`/api/todos/${this.currentEditId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(todoData)
                });
            } else {
                response = await fetch('/api/todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(todoData)
                });
            }

            if (response.ok) {
                this.closeModal();
                await this.loadTodos();
                this.showSuccess(this.currentEditId ? 'Task updated successfully!' : 'Task created successfully!');
            } else {
                this.showError('Failed to save todo');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    async editTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            this.openModal(todo);
        }
    }

    async deleteTodo(id) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const response = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await this.loadTodos();
                this.showSuccess('Task deleted successfully!');
            } else {
                this.showError('Failed to delete todo');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1001;
            max-width: 300px;
            background-color: ${type === 'success' ? '#27ae60' : '#e74c3c'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize the app
const app = new TodoApp();