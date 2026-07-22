# 🛒 E-commerce API

A practice project: a full-featured e-commerce REST API built with Express, Prisma, and PostgreSQL — covering authentication, role-based access control, product/category management, shopping cart (guest + logged-in), and Stripe-powered checkout with webhook-driven order fulfillment.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| 🖥️ Runtime | Node.js + Express |
| 🗄️ Database | PostgreSQL, via Prisma ORM |
| 🔐 Auth | JWT (access + refresh tokens), httpOnly cookies |
| 📁 File uploads | Multer (local disk storage) |
| 💳 Payments | Stripe Checkout + Webhooks |
| 🔑 Password hashing | bcrypt |

---

## ✨ Features

- 👤 User registration, login, logout, and token refresh (with refresh token rotation)
- 🛡️ Role-based access control (`ADMIN`, `CUSTOMER`) via a many-to-many `UserRole` join table
- 🖼️ Profile management, including profile image upload
- 🗂️ Category CRUD (admin-only writes, public reads)
- 📦 Product CRUD with multi-image upload, filtering, search, and pagination (admin-only writes, public reads)
- 🛒 Shopping cart supporting both guest sessions and logged-in users, with automatic cart merging on login
- 💳 Stripe Checkout integration: server-computed totals, price snapshotting on order creation
- 🔔 Stripe webhook handling with signature verification and idempotency (prevents duplicate processing on retries)
- 📜 Order history, order detail, self-service cancellation with automatic refunds, and admin order status updates
- 🧹 Soft-delete pattern for user accounts and products (preserves order history integrity)

---

## 🚀 Getting Started

### ✅ Prerequisites

- Node.js 18+
- PostgreSQL database
- A [Stripe](https://dashboard.stripe.com/register) account (test mode is fine)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)

### ⚙️ Setup

1. **Clone the repo and install dependencies:**

   ```bash
   npm install
   ```

2. **Copy `.env.example` to `.env`** and fill in your values (see below).

3. **Run migrations:**

   ```bash
   npx prisma migrate dev
   ```

4. **Start the server:**

   ```bash
   npm run dev
   ```

5. **In a separate terminal, forward Stripe webhooks to your local server:**

   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```

   Copy the signing secret it prints into `STRIPE_WEBHOOK_SECRET` in your `.env`, then restart the server.

---

### 🔧 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (defaults to 3000) |
| `NODE_ENV` | `development` or `production` — controls cookie security flags and error verbosity |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode: `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (from `stripe listen` or your dashboard) |
| `CLIENT_URL` | Base URL of the frontend, used for Stripe redirect URLs |

---

## 📚 API Overview

Full endpoint details with example requests are in the included Postman collection (`E-commerce-API.postman_collection.json`) — import it directly into Postman to explore and test every route.

| Module | Base Path | Notes |
|---|---|---|
| 🔐 Auth | `/auth` | Register, login, logout, refresh |
| 👤 Users | `/users` | Profile get/update, profile image upload |
| 🗂️ Categories | `/categories` | Public reads, admin-only writes |
| 📦 Products | `/products` | Public reads with filter/search/pagination, admin-only writes, image upload |
| 🛒 Cart | `/cart` | Works for both guests (session cookie) and logged-in users |
| 📜 Orders | `/orders` | Checkout, order history/detail, cancellation with refunds, admin status updates |
| 🔔 Webhooks | `/webhooks/stripe` | Stripe event handling — not called directly by clients |

---

## 🔐 Authentication

This API uses **httpOnly cookies** rather than an `Authorization` header, since it's designed for a browser-based frontend. This protects tokens from being read by client-side JavaScript (XSS mitigation).

- 🎫 `access_token` — short-lived (15 min), required for authenticated routes
- ♻️ `refresh_token` — longer-lived (7 days), used to obtain a new access token via `POST /auth/refresh`, rotated on each use

> 💡 **Tip:** When testing in Postman, make sure cookies are enabled for your workspace — they'll persist automatically across requests once you log in.

---

## 👥 Guest Cart

Carts work without an account: the first time a visitor adds an item, a `cart_session` cookie is issued and the cart is tied to that session. If the visitor later logs in, their guest cart is automatically merged into their account's cart (or reassigned to it, if they had none).

---

## 💳 Order & Payment Flow

1. **`POST /orders/checkout`** — validates stock, computes the total server-side, creates a `PENDING` order with price-snapshotted line items, creates a Stripe Checkout Session, and clears the cart.
2. 🔗 The client redirects to the returned `checkoutUrl` (Stripe's hosted payment page).
3. ✅ On successful payment, Stripe sends a `checkout.session.completed` webhook, which the API verifies and uses to mark the order `PAID`, decrement stock, and record the payment.
4. ❌ Customers can cancel a `PENDING` or `PAID` order via `PATCH /orders/:id/cancel` — cancelling a paid order automatically issues a Stripe refund and restores stock. Cancellation is blocked once an order is `SHIPPED` or `DELIVERED`.

---

## 📝 Notes

- 💲 Prices are stored as `Decimal` in the database to avoid floating-point rounding issues.
- 🧹 Product and user deletions are soft deletes (`deletedAt` timestamp) to preserve order history integrity.
- 🔒 Refresh tokens are stored as SHA-256 hashes, never in plaintext, in case of a database compromise.