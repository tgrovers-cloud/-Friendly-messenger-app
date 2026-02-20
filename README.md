**💬 Friendly Messenger — Real-Time Chat App**

**Full-stack messaging app with authentication and real-time updates**

**Why this project matters**

This project shows my understanding of full-stack development, including backend APIs, databases, authentication, and frontend state management.

**What it does**

User registration and login

JWT-based authentication

One-to-one conversations by username

Send and receive messages in real time

Message history stored in a database

Unread message tracking

**Tech Stack**

**Backend**

FastAPI

SQLite

SQLAlchemy

JWT authentication

WebSockets

**Frontend**

React

Fetch API

LocalStorage

**How it works (simple)**

Users register and log in with a username and password.

Passwords are hashed before being stored.

On login, the backend issues a JWT token.

The frontend sends the token with every request.

Messages are saved to the database and broadcast via WebSockets.

**Key Skills Demonstrated**

REST API design with FastAPI

Authentication and authorization using JWT

Database modeling and ORM usage

Real-time communication with WebSockets

Frontend state management in React

**What I learned**

How to build a secure auth flow from scratch

How to design relational data models

How WebSockets work in practice

How frontend and backend stay in sync

**Improvements I’d make next**

Add group chats

Replace polling with full WebSocket sync

Add typing indicators and read receipts

Deploy with Docker
