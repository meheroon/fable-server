# 📚 Fable Server

Backend API for the Fable Digital Ebook Marketplace.

The server provides authentication, ebook management, payment processing, user management, bookmark system and admin features.

---

## 🌐 Live API

https://fable-server-oaig.onrender.com

---

## 🚀 Features

- JWT Authentication
- Firebase User Registration Support
- Role-based Authorization
- Admin APIs
- Writer APIs
- Reader APIs
- MongoDB Database
- Stripe Payment Integration
- Bookmark Management
- Purchase History
- Featured Ebook API
- Top Writers API
- Statistics API

---

## 🛠️ Technologies

- Node.js
- Express.js
- MongoDB Atlas
- JWT
- Stripe
- bcrypt
- dotenv
- cors

---

## 📦 Installation

Clone repository

```bash
git clone https://github.com/meheroon/fable-server.git
```

Install packages

```bash
npm install
```

Run server

```bash
npm start
```

or

```bash
npm run dev
```

---

## 🔑 Environment Variables

Create `.env`

```env
PORT=
DB_URI=
JWT_SECRET=
STRIPE_SECRET_KEY=
CLIENT_URL=
```

---

## 📂 API Endpoints

### Authentication

```
POST /register
POST /login
```

### Users

```
GET /users
GET /users/:email
PATCH /users/:id
```

### Ebooks

```
GET /ebooks
GET /featured-ebooks
GET /top-writers
POST /ebooks
PATCH /ebooks/:id
DELETE /ebooks/:id
```

### Bookmarks

```
GET /bookmarks
POST /bookmarks
DELETE /bookmarks/:id
```

### Payments

```
POST /create-payment-intent
POST /payments
GET /transactions
```

### Admin

```
GET /admin/users
GET /admin/dashboard
GET /admin/ebooks
```

---

## 🗄 Database

MongoDB Atlas

Collections

- users
- ebooks
- bookmarks
- purchases
- transactions

---

## 🔐 Authentication

- JWT Token
- Protected Routes
- Role Based Authorization

---

## 👨‍💻 Developer

Kamrul Ahsan
