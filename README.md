💬 Friendly Messenger

A simple full-stack real-time chat application

Overview

Friendly Messenger is a lightweight 1-to-1 messaging app where users can register, log in, start conversations by username, and exchange messages in real time.

The project was built to practice authentication, API design, database modeling, and real-time communication.

Features

👤 User registration and login

🔐 JWT-based authentication

💬 One-to-one conversations

📡 Real-time messaging with WebSockets

📬 Message history stored in a database

🔔 Unread message tracking

🎨 Auto-generated avatars from usernames

Tech Stack
Backend

FastAPI

SQLite

SQLAlchemy

JWT authentication

WebSockets

Frontend

React

Fetch API

LocalStorage for session + unread tracking

How It Works (Simple Explanation)

Users register and log in using a username and password.

Passwords are hashed before being stored.

On login, the backend returns a JWT token.

The frontend stores the token and sends it with every request.

Users can start a conversation by entering another username.

Messages are saved to the database.

When a message is sent, the backend broadcasts it via WebSockets to everyone in that conversation.

Why JWT + WebSockets?

JWT keeps the backend stateless and simple.

WebSockets allow messages to appear instantly without refreshing.

Access control ensures only conversation members can read/send messages.

What I Learned

Designing REST APIs with authentication

Using WebSockets for real-time updates

Managing frontend state for unread messages

Structuring a full-stack app from scratch

Possible Improvements

Persist WebSocket connections with Redis

Group chats

Message read receipts

Deployment with Docker
