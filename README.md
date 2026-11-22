# Nexus Marketplace with Gemini LLM Tool Calling (Version 2)

A full-stack e-commerce and administrative platform built with **Node.js/Express**, **React (Vite)**, **MongoDB**, and **Nexus AI (powered by Google Gemini Tool Calling)**.

---

## 🌟 Version 2 Enhancements

### 1. Default Chat-First Experience
- **Chat Window by Default**: All roles (Admin, Seller, Buyer) are immediately greeted by the **Nexus AI Copilot** on login.
- **Persistent Multi-Chat History**: Users can create multiple separate conversations, switch between saved chats, and delete conversations (persisted in MongoDB via `ChatConversation` collection).
- **Clean Markdown & Table Formatting**: LLM responses are presented in clear, human-readable English text and Markdown tables (raw JSON is exclusively contained within the collapsible "Executed Tools" cards).
- **"Who Am I?" Personalization**: Asking *"Who am I?"* or *"Tell me about myself"* calls the `whoAmI` tool and presents a formatted profile table with role-specific stats and account privileges.
- **Embedded API Key**: Gemini API key is configured seamlessly via `.env` (`process.env.GEMINI_API_KEY`), removing manual key entry from the UI.

### 2. Role-Based AI Copilot Capabilities
- **Admin**:
  - `whoAmI()`: Profile and system admin details.
  - `getPlatformStats()`: Platform sales, order count, user count, and pending verifications.
  - `listUsers({ role, status })`: Query users.
  - `updateUserStatus({ userIdOrEmail, status })`: Approve, reject, or block users.
  - `listOrders({ status })`: Inspect platform orders.
  - `updateOrderStatus({ orderId, status })`: Intervene on orders.
- **Seller**:
  - `whoAmI()`: Seller profile and active store metrics.
  - `getSellerEarnings()`: Financial metrics including **Delivered Earnings**, **Upcoming / Pending Earnings**, orders count, and units sold.
  - `listMyProducts()`: Inspect store inventory and pricing.
  - `addProduct({ title, description, quantity, price, discount })`: Add single products via chat prompt.
  - `updateProduct({ productIdOrTitle, ... })` & `deleteProduct({ productIdOrTitle })`: Catalog management.
  - `listSellerOrders({ status })`: Review incoming orders.
  - `updateSellerOrderStatus({ orderId, status })`: Accept, decline, or deliver orders.
  - *(Bulk upload option removed from UI as requested)*.
- **Buyer**:
  - `whoAmI()`: Buyer profile and orders placed.
  - `browseProducts({ query, maxPrice })`: Discover products.
  - `buyProduct({ productIdOrTitle, quantity })`: **Purchase items directly inside the chat window** with automatic discount calculation and stock reservation.
  - `listMyOrders({ status })`: View personal order history.
  - `cancelOrder({ orderId })`: Cancel pending orders.

---

## 🔑 Pre-Seeded Demo Accounts

The database automatically seeds the following accounts:

| Role | Email | Password | Status | Default View |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@marketplace.com` | `adminpassword123` | `approved` | Nexus AI Copilot |
| **Seller** | `seller@apex.com` | `sellerpassword123` | `approved` | Nexus AI Copilot |
| **Buyer** | `alice@example.com` | `buyerpassword123` | `approved` | Nexus AI Copilot |

*(A one-click demo login toolbar and top navigation role switcher are integrated for instant testing without manual credential typing).*

---

## 🚀 Quick Start

### 1. Installation
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Configuration
Ensure `.env` contains:
```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/marketplace
JWT_SECRET=supersecret_jwt_key_marketplace_2026
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the Services
```bash
# Run backend server
node server.js

# Run frontend Vite dev server (in another terminal or access port 5001 directly)
cd frontend && npm run dev
```

- **Frontend URL**: `http://localhost:5174` (or `http://localhost:5001`)
- **Backend API**: `http://localhost:5001/api`
