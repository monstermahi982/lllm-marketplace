# Nexus Marketplace with LangChain LLM Tool Calling (Version 3)

A full-stack multi-role marketplace platform built with **Node.js/Express**, **React (Vite)**, **MongoDB**, and **LangChain Agentic Tool Calling (with Human-In-The-Loop Database Confirmation)**.

---

## 🌟 Version 3 Enhancements

### 1. LangChain Provider-Agnostic Agent Architecture
- Migrated tool definitions and agent execution to **LangChain** (`@langchain/core`, `@langchain/google-genai`, `zod`).
- Standardized schemas using Zod.
- **Future-Proof**: Built on `@langchain/core` message and tool specifications, allowing seamless swapping to Claude (`@langchain/anthropic`) or GPT-4o (`@langchain/openai`) without changing tool definitions or business logic.

### 2. Human-In-The-Loop (HITL) Write Confirmation
- **Safe Database Operations**: Whenever a write operation is initiated (approving/blocking users, modifying order status, creating/editing products, purchasing items, or cancelling orders), Nexus AI halts execution, drafts the exact proposed changes, and asks for explicit user confirmation:
  > *"Do you agree to proceed with these changes? Please confirm (yes / no)."*
- **Interactive UI Decision Card**: The chatbox renders an actionable confirmation panel with:
  - `[✓ Confirm & Apply Changes]`
  - `[✕ Cancel]`
- Users can also confirm naturally by typing `"yes"`, `"confirm"`, `"agreed"`, or cancel by typing `"no"`, `"cancel"`.

### 3. Unified Full-Width Chatbox UI with Smooth Scrolling
- **Identical Experience Across Roles**: Admin, Seller, and Buyer views all share the same full-width Nexus Copilot interface.
- **Multi-Chat History Sidebar**: Prominently displays all saved conversations with one-click `+ New Chat`, conversation selection, and deletion. Includes a toggle button to collapse/expand the sidebar.
- **Scroll Fix**: Fixed flexbox scrolling constraints (`min-height: 0; flex: 1 1 0%; overflow-y: auto`) with custom clean scrollbars and auto-scrolling to latest messages.

### 4. Dynamic Quick Action Pills on Login
Pre-configured, one-click action chips tailored to current user role:
- **Show today's users approval** (Admin)
- **Show new orders** (Admin / Seller / Buyer)
- **Orders to review** (Admin / Seller / Buyer)
- **Recent products** (Admin / Seller / Buyer)
- **Show my earnings & revenue** (Seller)
- **Who am I? Tell me about myself** (All roles)

---

## 🔑 Pre-Seeded Demo Accounts

| Role | Email | Password | Status | Default View |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@marketplace.com` | `adminpassword123` | `approved` | Nexus AI Copilot |
| **Seller** | `seller@apex.com` | `sellerpassword123` | `approved` | Nexus AI Copilot |
| **Buyer** | `alice@example.com` | `buyerpassword123` | `approved` | Nexus AI Copilot |

*(A one-click demo login toolbar and top navigation role switcher are available for rapid role switching).*

---

## 🚀 Quick Start

### 1. Installation
```bash
# Backend dependencies (including LangChain & Zod)
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

### 3. Running Services
```bash
# Start backend server
node server.js

# Start frontend dev server
cd frontend && npm run dev
```

- **Frontend URL**: `http://localhost:5174` (or `http://localhost:5001`)
- **Backend API**: `http://localhost:5001/api`
