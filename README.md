# Multi-Role Marketplace with Gemini LLM Tool Calling

A full-stack e-commerce and administrative platform built with **Node.js/Express**, **React (Vite)**, **MongoDB**, and **Google Gemini LLM Tool Calling / Function Calling**.

---

## 🌟 Key Features

### 1. Multi-Role User Architecture & Verification
- **Admin**:
  - Full oversight over users and orders.
  - Approve, reject, or block buyers and sellers.
  - Natural language **AI Assistant with LLM Tool Calling** to query metrics, inspect orders, and execute administrative actions.
- **Sellers**:
  - Manage inventory (single product creation and **bulk upload** via JSON).
  - Configure title, description, quantity, price, and percentage discount.
  - Review and fulfill incoming customer orders (Accept, Decline, Deliver).
- **Buyers**:
  - Search and filter products in real-time.
  - Automatic discount calculations and stock reservation.
  - Track personal order status and cancel pending orders.
  - Protected by admin verification before purchasing.

### 2. Gemini LLM Tool Calling
The Admin AI Assistant connects directly to MongoDB via structured function declarations:
- `listUsers({ role, status, limit })`
- `updateUserStatus({ userIdOrEmail, status, reason })`
- `listOrders({ status, limit })`
- `updateOrderStatus({ orderId, status })`
- `getPlatformStats()`
- `searchProducts({ query })`

Includes both live Gemini function calling (`gemini-1.5-flash`) and a built-in local tool execution engine for fallback and offline testing.

### 3. Minimalist Swiss-Style Design
- Clean, focused interface following minimalist design principles (no funky colors or clutter).
- Subtle, high-contrast status indicators (approved, pending, rejected, blocked).
- Live tool execution visualizer showing exact input arguments and JSON tool responses.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18+ recommended)
- **MongoDB** running locally on default port `27017`

### 1. Installation
Dependencies are already configured:
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Configuration
Create or edit `.env` in the root directory:
```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/marketplace
JWT_SECRET=supersecret_jwt_key_marketplace_2026
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Tip: You can obtain a free Gemini API key from [Google AI Studio](https://aistudio.google.com/). You can also input it directly in the Admin AI UI settings at runtime).*

### 3. Running the Application
```bash
# Start backend (serves API & pre-built frontend)
npm start
# or for auto-reload:
npm run dev

# Start frontend dev server
cd frontend && npm run dev
```

- **Frontend URL**: `http://localhost:5174` (or `http://localhost:5001`)
- **Backend API**: `http://localhost:5001/api`

---

## 🔑 Pre-Seeded Demo Accounts

The database automatically seeds the following interactive accounts:

| Role | Email | Password | Status |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@marketplace.com` | `adminpassword123` | `approved` |
| **Seller** | `seller@apex.com` | `sellerpassword123` | `approved` |
| **Buyer** | `alice@example.com` | `buyerpassword123` | `approved` |

*(A one-click demo login toolbar is also integrated into both the login view and the navigation header for testing)*.

---

## 📡 API Reference

- `POST /api/auth/register` - Create user profile
- `POST /api/auth/login` - Authenticate & obtain JWT
- `GET /api/auth/me` - Profile inspection
- `GET /api/admin/users` - Admin user list & filter
- `PATCH /api/admin/users/:id/status` - Admin approve/reject/block
- `GET /api/admin/orders` - Admin order oversight
- `GET /api/admin/stats` - Platform metrics & GMV
- `GET /api/products` - Public product catalog with search
- `POST /api/products` - Seller add product
- `POST /api/products/bulk` - Seller bulk add products
- `POST /api/orders` - Buyer checkout with stock reservation
- `GET /api/orders/my-orders` - Buyer order history
- `POST /api/ai/chat` - Admin Gemini AI natural language chat with tool execution
