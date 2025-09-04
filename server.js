const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'todos.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize database file
async function initializeDB() {
  try {
    await fs.access(DB_FILE);
  } catch (error) {
    // File doesn't exist, create it with sample data
    const sampleData = [
      {
        id: 1,
        header: "Complete Project Proposal",
        description: "Finish writing the quarterly project proposal for the client meeting",
        startDate: "2024-01-15",
        dueDate: "2024-01-20",
        priority: "high",
        status: "in-progress"
      },
      {
        id: 2,
        header: "Team Meeting",
        description: "Weekly team sync to discuss project progress and blockers",
        startDate: "2024-01-16",
        dueDate: "2024-01-16",
        priority: "medium",
        status: "pending"
      },
      {
        id: 3,
        header: "Code Review",
        description: "Review pull requests from team members and provide feedback",
        startDate: "2024-01-10",
        dueDate: "2024-01-18",
        priority: "low",
        status: "completed"
      }
    ];
    await fs.writeFile(DB_FILE, JSON.stringify(sampleData, null, 2));
  }
}

// Read todos from JSON file
async function readTodos() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write todos to JSON file
async function writeTodos(todos) {
  await fs.writeFile(DB_FILE, JSON.stringify(todos, null, 2));
}

// Sort todos by priority (high > medium > low) then by due date
function sortTodos(todos) {
  const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
  
  return todos.sort((a, b) => {
    // First sort by priority
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }
    // Then sort by due date
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
}

// API Routes

// Get all todos
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await readTodos();
    const sortedTodos = sortTodos(todos);
    res.json(sortedTodos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// Get single todo
app.get('/api/todos/:id', async (req, res) => {
  try {
    const todos = await readTodos();
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(todo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// Create new todo
app.post('/api/todos', async (req, res) => {
  try {
    const todos = await readTodos();
    const newTodo = {
      id: todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1,
      header: req.body.header,
      description: req.body.description,
      startDate: req.body.startDate,
      dueDate: req.body.dueDate,
      priority: req.body.priority,
      status: req.body.status || 'pending'
    };
    
    todos.push(newTodo);
    await writeTodos(todos);
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// Update todo
app.put('/api/todos/:id', async (req, res) => {
  try {
    const todos = await readTodos();
    const index = todos.findIndex(t => t.id === parseInt(req.params.id));
    
    if (index === -1) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    todos[index] = { ...todos[index], ...req.body };
    await writeTodos(todos);
    res.json(todos[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// Delete todo
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const todos = await readTodos();
    const filteredTodos = todos.filter(t => t.id !== parseInt(req.params.id));
    
    if (filteredTodos.length === todos.length) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    await writeTodos(filteredTodos);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initializeDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});