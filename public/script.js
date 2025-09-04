class TodoApp {
    constructor() {
        this.todos = [];
        this.currentEditId = null;
        this.socket = io();
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupWebSocket();
        this.loadTodos();
        this.setDefaultDates();
    }

    setupWebSocket() {
        // Listen for real-time updates from server
        this.socket.on('todosUpdated', (updatedTodos) => {
            this.todos = updatedTodos;
            this.renderTodos();
            
            // Show a subtle notification that data was updated from another device
            if (document.visibilityState === 'visible') {
                this.showRealtimeNotification('List updated from another device');
            }
        });

        // Handle connection status
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
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
                // Don't reload todos here - WebSocket will handle the update
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
                // Don't reload todos here - WebSocket will handle the update
                this.showSuccess('Task deleted successfully!');
            } else {
                this.showError('Failed to delete todo');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        }
    }

    async handleFileSelect(files) {
        const fileArray = Array.from(files);
        
        for (const file of fileArray) {
            if (file.size > 10 * 1024 * 1024) {
                this.showError(`File ${file.name} is too large. Maximum size is 10MB.`);
                continue;
            }
            
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            this.showUploadProgress(`Uploading ${file.name}...`);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const fileInfo = await response.json();
                this.pendingAttachments.push(fileInfo);
                this.renderAttachments();
                this.hideUploadProgress();
            } else {
                const error = await response.json();
                this.showError(`Failed to upload ${file.name}: ${error.error}`);
                this.hideUploadProgress();
            }
        } catch (error) {
            this.showError(`Upload failed: ${error.message}`);
            this.hideUploadProgress();
        }
    }

    renderAttachments() {
        const attachmentsList = document.getElementById('attachmentsList');
        
        if (this.pendingAttachments.length === 0) {
            attachmentsList.innerHTML = '';
            return;
        }

        attachmentsList.innerHTML = this.pendingAttachments.map((file, index) => `
            <div class="attachment-item">
                <div class="attachment-info">
                    <span class="file-icon">${this.getFileIcon(file.mimetype)}</span>
                    <div class="attachment-details">
                        <div class="attachment-name">${file.originalName}</div>
                        <div class="attachment-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button type="button" class="remove-attachment" onclick="app.removeAttachment(${index})" title="Remove file">
                    ×
                </button>
            </div>
        `).join('');
    }

    removeAttachment(index) {
        const attachment = this.pendingAttachments[index];
        
        // Remove from server if it's a newly uploaded file
        if (attachment.filename && !this.currentEditId) {
            fetch(`/api/files/${attachment.filename}`, { method: 'DELETE' })
                .catch(error => console.log('Error deleting file:', error));
        }
        
        this.pendingAttachments.splice(index, 1);
        this.renderAttachments();
    }

    getFileIcon(mimetype) {
        if (mimetype.startsWith('image/')) return '🖼️';
        if (mimetype.includes('pdf')) return '📄';
        if (mimetype.includes('document') || mimetype.includes('word')) return '📝';
        if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return '📊';
        if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return '📊';
        if (mimetype.includes('zip') || mimetype.includes('rar')) return '📦';
        if (mimetype.startsWith('text/')) return '📄';
        return '📁';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showUploadProgress(message) {
        const attachmentsList = document.getElementById('attachmentsList');
        const progressDiv = document.createElement('div');
        progressDiv.className = 'upload-progress';
        progressDiv.id = 'uploadProgress';
        progressDiv.textContent = message;
        attachmentsList.appendChild(progressDiv);
    }

    hideUploadProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.remove();
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

    showRealtimeNotification(message) {
        // Subtle notification for real-time updates
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1001;
            max-width: 300px;
            background-color: #3498db;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            font-size: 14px;
            opacity: 0.9;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 2000);
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