
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = 5000;

// CORS middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// JSON middleware
app.use(express.json());

let users;
try {
    users = JSON.parse(process.env.SPEAKBUBBLE_USERS || '[]');
} catch {
    throw new Error('SPEAKBUBBLE_USERS must contain valid JSON. See .env.example.');
}

if (
    !Array.isArray(users) ||
    users.length === 0 ||
    users.some(user =>
        !Number.isInteger(user.id) ||
        typeof user.username !== 'string' ||
        !user.username.trim() ||
        typeof user.password !== 'string' ||
        !user.password
    )
) {
    throw new Error('SPEAKBUBBLE_USERS must be a non-empty JSON array of users with id, username, and password. See .env.example.');
}

// Active sessions
let sessions = {};

// Authentication middleware
function authenticate(req, res, next) {
    const token = req.headers.authorization;

    if (!token || !sessions[token]) {
        return res.status(401).json({
            message: "Please login first"
        });
    }

    req.userId = sessions[token];
    next();
}

// Chat rooms
let rooms = [
    { id: 1, name: "General", members: [1, 2, 3] },
    { id: 2, name: "Developers", members: [1, 2] }
];

// Messages
let messages = [
    {
        id: 1,
        roomId: 1,
        senderId: 2,
        text: "Hey everyone!",
        time: new Date()
    },
    {
        id: 2,
        roomId: 1,
        senderId: 3,
        text: "Hello!",
        time: new Date()
    }
];

// Connected SSE clients
let clients = [];

// Get all users (hide passwords)
app.get('/api/users', authenticate, (req, res) => {
    const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username
    }));

    res.json(safeUsers);
});

// Get all chat rooms
app.get('/api/rooms', authenticate, (req, res) => {
    const userRooms = rooms.filter(room =>
        room.members.includes(req.userId)
    );

    res.json(userRooms);
});

// Get messages of a particular room
app.get('/api/rooms/:roomId/messages', authenticate, (req, res) => {
    const roomId = Number(req.params.roomId);

    const room = rooms.find(r => r.id === roomId);

    if (!room) {
        return res.status(404).json({
            message: "Room not found"
        });
    }

    if (!room.members.includes(req.userId)) {
        return res.status(403).json({
            message: "You are not a member of this room"
        });
    }

    const roomMessages = messages.filter(
        m => m.roomId === roomId
    );

    res.json(roomMessages);
});

// Send a new message
app.post('/api/rooms/:roomId/messages', authenticate, (req, res) => {
    const roomId = Number(req.params.roomId);
    const { text } = req.body;

    const room = rooms.find(r => r.id === roomId);

    // Validate room
    if (!room) {
        return res.status(404).json({
            message: "Room not found"
        });
    }

    // Check room membership
    if (!room.members.includes(req.userId)) {
        return res.status(403).json({
            message: "You are not a member of this room"
        });
    }

    // Validate message
    if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({
            message: "Message cannot be empty"
        });
    }

    const newMessage = {
        id: messages.length + 1,
        roomId,
        senderId: req.userId,
        text: text.trim(),
        time: new Date()
    };

    // Save message in memory
    messages.push(newMessage);

    // Broadcast to connected room members
    clients.forEach(client => {
        if (room.members.includes(client.userId)) {
            client.res.write(
                `data: ${JSON.stringify(newMessage)}\n\n`
            );
        }
    });

    res.status(201).json({
        message: "Message sent successfully",
        data: newMessage
    });
});

// Server-Sent Events
app.get('/api/events', (req, res) => {

    // Get token from URL
    const token = req.query.token;

    // Validate session
    if (!token || !sessions[token]) {
        return res.status(401).end();
    }

    const userId = sessions[token];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();

    // Register connected client
    const client = {
        res,
        userId
    };

    clients.push(client);

    // Remove client when disconnected
    req.on('close', () => {
        clients = clients.filter(c => c !== client);
    });
});

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const user = users.find(
        u =>
            u.username.toLowerCase() === username?.trim().toLowerCase() &&
            u.password === password
    );

    if (!user) {
        return res.status(401).json({
            message: "Invalid username or password"
        });
    }

    const token = crypto.randomBytes(32).toString('hex');

    sessions[token] = user.id;

    res.json({
        message: "Login successful",
        token: token,
        user: {
            id: user.id,
            username: user.username
        }
    });
});
// Logout API
app.post('/api/logout', (req, res) => {
    const token = req.headers.authorization;

    if (!token || !sessions[token]) {
        return res.status(401).json({
            message: "Invalid session"
        });
    }

    // Remove active SSE connections for this user
    clients.forEach(client => {
        if (client.userId === sessions[token]) {
            client.res.end();
        }
    });

    clients = clients.filter(
        client => client.userId !== sessions[token]
    );

    // Delete session
    delete sessions[token];

    res.json({
        message: "Logged out successfully"
    });
});

// Test route
app.get('/', (req, res) => {
    res.send('Welcome to SpeakBubble API!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
