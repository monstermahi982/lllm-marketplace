# Multi-Role Marketplace Platform with Gemini LLM Tool Calling
## Technical Architecture & Implementation Specification

---

### 1. Platform Overview
The platform is a multi-role e-commerce and inventory marketplace built with:
- **Backend**: Node.js, Express.js, MongoDB (Mongoose ORM), JWT Authentication.
- **Frontend**: React (Vite), Minimalist & Clean UI (vanilla CSS design system), responsive layout.
- **AI Agent**: Google Gemini API with native **Function Calling / Tool Calling** capabilities allowing Admin to query and manage platform users, inventory, and orders through natural language.

---

### 2. User Roles & Access Control Matrix

| Role | Default Status on Signup | Capabilities |
| :--- | :--- | :--- |
| **Admin** | `approved` (Seed / Admin role) | - Verify/Approve/Reject/Block buyers and sellers.<br>- Oversee all platform orders and intervene (cancel/reject).<br>- Natural language AI Assistant with live LLM tool calling to execute administrative actions.<br>- View system metrics. |
| **Seller** | `pending` (Must be verified by Admin) | - Manage product catalog (Single create, Edit, Delete).<br>- **Bulk product upload/creation**.<br>- Real-time inventory tracking.<br>- Review incoming orders (Approve / Reject / Mark fulfilled). |
| **Buyer** | `pending` (Must be verified by Admin) | - Search, filter, and browse approved products with discounts.<br>- Place orders with automated inventory deduction.<br>- View personal order history & cancel pending orders.<br>- View profile verification status. |

---

### 3. Data Models (MongoDB Mongoose)

#### 3.1. User Model (`User`)
- `name` (String, required)
- `email` (String, required, unique, lowercase, trimmed)
- `password` (String, required, hashed with bcrypt)
- `role` (String, enum: `['admin', 'seller', 'buyer']`, default: `'buyer'`)
- `status` (String, enum: `['pending', 'approved', 'rejected', 'blocked']`, default: `'pending'`)
- `timestamps` (`createdAt`, `updatedAt`)

#### 3.2. Product Model (`Product`)
- `title` (String, required, trimmed)
- `description` (String, default: '')
- `quantity` (Number, required, min: 0)
- `price` (Number, required, min: 0)
- `discount` (Number, default: 0, min: 0, max: 100) — percentage discount
- `seller` (ObjectId ref `'User'`, required)
- `timestamps` (`createdAt`, `updatedAt`)

#### 3.3. Order Model (`Order`)
- `buyer` (ObjectId ref `'User'`, required)
- `product` (ObjectId ref `'Product'`, required)
- `seller` (ObjectId ref `'User'`, required)
- `quantity` (Number, required, min: 1)
- `unitPrice` (Number, required)
- `discount` (Number, default: 0)
- `totalPrice` (Number, required) — calculated: `(unitPrice * (1 - discount/100)) * quantity`
- `status` (String, enum: `['pending', 'approved', 'rejected', 'cancelled', 'completed']`, default: `'pending'`)
- `timestamps` (`createdAt`, `updatedAt`)

---

### 4. API Specification

#### 4.1. Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a buyer or seller. Body: `{ name, email, password, role }`
- `POST /api/auth/login` - Login with credentials. Returns JWT token and sanitized user profile.
- `GET /api/auth/me` - Authenticated session validation.

#### 4.2. Users & Admin Management (`/api/admin`)
- `GET /api/admin/users` - List all users (filter by role/status).
- `PATCH /api/admin/users/:id/status` - Update user verification status (`approved`, `rejected`, `blocked`).
- `GET /api/admin/orders` - View all platform orders with buyer and seller populated.
- `PATCH /api/admin/orders/:id/status` - Admin intervention on orders.
- `GET /api/admin/stats` - Platform statistics (user counts, order counts, GMV).

#### 4.3. Products (`/api/products`)
- `GET /api/products` - Search and list active products with stock > 0 (Public/Buyers).
- `GET /api/products/seller` - List seller's own products (Seller only).
- `POST /api/products` - Create single product (Seller only).
- `POST /api/products/bulk` - Create multiple products in bulk (Seller only).
- `PUT /api/products/:id` - Update product details or stock (Seller only).
- `DELETE /api/products/:id` - Remove product (Seller only).

#### 4.4. Orders (`/api/orders`)
- `POST /api/orders` - Place new order (Buyer only). Atomically checks and reserves product stock.
- `GET /api/orders/my-orders` - Get buyer order history (Buyer only).
- `GET /api/orders/seller-orders` - Get orders placed for seller's products (Seller only).
- `PATCH /api/orders/:id/status` - Seller/Buyer order status transition (Approve, Reject, Cancel).

#### 4.5. AI Assistant & LLM Tool Calling (`/api/ai`)
- `POST /api/ai/chat` (Admin only)
  - Body: `{ message, history }`
  - Uses Google Gemini API with function calling definitions.
  - LLM can invoke the following platform tools:
    1. `listUsers({ role, status, limit })` - Retrieve users matching criteria.
    2. `updateUserStatus({ userId, status, reason })` - Approve, reject, or block a user.
    3. `listOrders({ status, limit })` - Fetch latest platform orders.
    4. `updateOrderStatus({ orderId, status })` - Change status of an order.
    5. `getPlatformStats()` - Query overall health, counts, and metrics.
    6. `searchProducts({ query })` - Search products across sellers.
  - Automatically executes the requested tool on MongoDB and feeds result back to Gemini to produce a clear, authoritative response.

---

### 5. Frontend Design Philosophy & Structure
- **Design Aesthetic**: Minimalist, clean, modern Swiss-style dashboard. No distracting colors or funky elements.
- **Color Palette**: Sophisticated grayscale (slate-900 `#0f172a`, slate-700 `#334155`, slate-100 `#f1f5f9`, clean white `#ffffff`) with subtle status accents (emerald green for approved, amber for pending, rose for rejected/blocked).
- **Core Views**:
  1. **Auth View**: Clean toggle between Login and Sign up (with role selection).
  2. **Admin Dashboard**:
     - Metric cards (Users, Pending Approvals, Total Orders).
     - User Management Table (one-click Approve, Reject, Block).
     - Orders Surveillance Table.
     - **AI Admin Assistant Panel**: Interactive chat interface with real-time tool execution logs.
  3. **Seller Dashboard**:
     - Product Inventory Manager (Add Product modal, Bulk JSON/CSV product creator).
     - Incoming Orders Manager with status toggles.
  4. **Buyer Storefront**:
     - Product Catalog with search bar and discount tags.
     - 1-Click Buy / Checkout modal.
     - My Orders tab with live order statuses and Cancel option.

---

### 6. Implementation Strategy (4-Phase Execution)
1. **Phase 1: Spec & Dependency Setup**:
   - Complete architectural specification.
   - Update `package.json` for backend with all necessary packages (`express`, `cors`, `dotenv`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `@google/genai`).
   - Update `frontend/package.json` with UI icons (`lucide-react`).
   - Install dependencies.
2. **Phase 2: Complete Backend**:
   - Database connection & models (`User`, `Product`, `Order`).
   - JWT Auth & role-check middleware.
   - Route handlers for Auth, Admin, Products (single & bulk), and Orders.
   - Ensure clean error handling and structured responses.
3. **Phase 3: Complete Frontend**:
   - Minimalist responsive CSS design system.
   - Auth context and JWT persistence.
   - Admin view, Seller view, and Buyer view with clean UX.
4. **Phase 4: Gemini LLM Tool Calling**:
   - Implement Gemini client with tool calling declarations.
   - Dynamic tool executor loop (`CALL` -> `EXECUTE` -> `RETURN RESULT` -> `FINAL RESPONSE`).
   - Interactive Admin AI terminal in the UI.
