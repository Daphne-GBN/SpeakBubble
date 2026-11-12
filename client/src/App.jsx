
import { useState, useEffect } from 'react';
import './App.css';

function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [rooms, setRooms] = useState([]);
    const [roomId, setRoomId] = useState(1);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    // Login
    const login = async () => {
        setError('');

        if (!username.trim() || !password) {
            setError('Please enter username and password');
            return;
        }

        try {
            const response = await fetch(
                'http://localhost:5000/api/login',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            setUser(data.user);
            setToken(data.token);
            setPassword('');
        } catch (err) {
            setError('Cannot connect to server');
        }
    };

    // Logout
    const logout = async () => {
        try {
            await fetch('http://localhost:5000/api/logout', {
                method: 'POST',
                headers: {
                    'Authorization': token
                }
            });
        } catch (err) {
            console.log('Logout error:', err);
        }

        setUser(null);
        setToken('');
        setRooms([]);
        setMessages([]);
        setText('');
        setUsername('');
        setPassword('');
        setRoomId(1);
        setError('');
    };

    // Handle expired or invalid session
    const handleAuthError = () => {
        setUser(null);
        setToken('');
        setRooms([]);
        setMessages([]);
        setError('Session expired. Please login again.');
    };

    // Get chat rooms
    useEffect(() => {
        if (!user || !token) return;

        fetch('http://localhost:5000/api/rooms', {
            headers: {
                'Authorization': token
            }
        })
            .then(async res => {
                if (res.status === 401) {
                    handleAuthError();
                    return [];
                }

                if (!res.ok) {
                    throw new Error('Could not load rooms');
                }

                return res.json();
            })
            .then(data => {
                if (data) {
                    setRooms(data);

                    if (data.length > 0 &&
                        !data.some(room => room.id === roomId)) {
                        setRoomId(data[0].id);
                    }
                }
            })
            .catch(err => console.log(err));

    }, [user, token]);

    // Get messages when room changes
    useEffect(() => {
        if (!user || !token) return;

        setMessages([]);

        fetch(`http://localhost:5000/api/rooms/${roomId}/messages`, {
            headers: {
                'Authorization': token
            }
        })
            .then(async res => {
                if (res.status === 401) {
                    handleAuthError();
                    return [];
                }

                if (!res.ok) {
                    throw new Error('Could not load messages');
                }

                return res.json();
            })
            .then(data => {
                if (data) setMessages(data);
            })
            .catch(err => console.log(err));

    }, [roomId, user, token]);

    // Receive live messages using SSE
    useEffect(() => {
        if (!user || !token) return;

        const source = new EventSource(
            `http://localhost:5000/api/events?token=${encodeURIComponent(token)}`
        );

        source.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.roomId === roomId) {
                setMessages(prev => {
                    if (prev.some(m => m.id === message.id)) {
                        return prev;
                    }

                    return [...prev, message];
                });
            }
        };

        source.onerror = () => {
            console.log('SSE connection error');
        };

        return () => source.close();

    }, [roomId, user, token]);

    // Send message
    const sendMessage = async () => {
        if (!text.trim() || !user || loading) return;

        setLoading(true);

        try {
            const response = await fetch(
                `http://localhost:5000/api/rooms/${roomId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify({
                        text: text
                    })
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                handleAuthError();
                return;
            }

            if (!response.ok) {
                setError(data.message || 'Message could not be sent');
                return;
            }

            setText('');
            setError('');

        } catch (err) {
            setError('Could not send message');
        } finally {
            setLoading(false);
        }
    };

    // Login screen
    if (!user) {
        return (
            <div className="login-container">
                <h1>SpeakBubble 💬</h1>

                <div className="login-box">
                    <h2>Login</h2>

                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') login();
                        }}
                    />

                    <button onClick={login}>
                        Login
                    </button>

                    {error && <p className="error">{error}</p>}

                    <small>
                        Sample: Daphne / daphne123
                    </small>
                </div>
            </div>
        );
    }

    // Chat screen
    return (
        <div className="app">
            <h1>SpeakBubble 💬</h1>

            <div className="user-info">
                Welcome, {user.username}!
                <button onClick={logout}>Logout</button>
            </div>

            <div className="chat-container">

                <div className="sidebar">
                    <h3>Chat Rooms</h3>

                    {rooms.map(room => (
                        <button
                            key={room.id}
                            className={roomId === room.id ? 'active' : ''}
                            onClick={() => setRoomId(room.id)}
                        >
                            {room.name}
                        </button>
                    ))}
                </div>

                <div className="chat-window">
                    <h2>
                        {rooms.find(r => r.id === roomId)?.name}
                    </h2>

                    <div className="messages">
                        {messages.map(message => (
                            <div
                                key={message.id}
                                className={
                                    message.senderId === user.id
                                        ? 'my-message'
                                        : 'other-message'
                                }
                            >
                                <p>{message.text}</p>
                                <small>
                                    User {message.senderId}
                                </small>
                            </div>
                        ))}
                    </div>

                    <div className="message-input">
                        <input
                            type="text"
                            placeholder="Type a message..."
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') sendMessage();
                            }}
                        />

                        <button
                            onClick={sendMessage}
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send'}
                        </button>
                    </div>

                    {error && <p className="error">{error}</p>}
                </div>

            </div>
        </div>
    );
}

export default App;
