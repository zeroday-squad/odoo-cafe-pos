# Odoo Cafe POS

Odoo Cafe POS is a full-stack cafe point-of-sale system for managing counter sessions, table orders, kitchen tickets, payments, customers, admin setup, and reports.

The system has two roles:

- **Admin**: can view and manage cafe setup data such as products, categories, floors, tables, coupons, promotions, payment methods, and users.
- **Cashier / Employee**: can use POS operations and view admin-provided setup data, but cannot create or modify admin setup records.

## Features

- User authentication with JWT
- Admin and cashier role permissions
- POS terminal for table orders
- Product and category browsing
- Cart, coupons, tax, discounts, and payment flow
- Table and floor management
- Customer management
- Kitchen Display System with live Socket.IO updates
- Order history
- Sales reports and top product/category summaries
- SQLite database with Prisma ORM
- Seed data for demo users, products, floors, tables, coupons, and promotions

## Tech Stack

**Frontend**

- React
- Vite
- CSS

**Backend**

- Node.js
- Express
- Prisma
- SQLite
- Socket.IO
- JWT authentication
- bcrypt password hashing

## Project Structure

```text
odoo cafe pos/
  backend/
    app.js
    server.js
    config/db.js
    middleware/authmiddleware.js
    prisma/
      schema.prisma
      seed.js
      dev.db
  frontend/
    src/
      App.jsx
      App.css
    package.json
```

## Demo Logins

After running the seed script, use these accounts:

```text
Admin
Email: admin@cafepos.com
Password: admin123

Cashier / Employee
Email: cashier@cafepos.com
Password: cashier123
```

## Environment Variables

Create a `backend/.env` file:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-secret"
PORT=5000
APP_NAME="Odoo Cafe POS"
BRAND_NAME="Cafe POS"
APP_TAGLINE="Run every table, ticket, and payment from one fast cafe console."
LOGIN_HEADLINE="One screen for cafe orders, kitchen flow, and payments."
```

Optional frontend environment file:

```env
VITE_API_URL=http://localhost:5000
```

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Database Setup

From the `backend` folder:

```bash
npx prisma migrate dev
npm run seed
```

The seed script creates demo users, products, categories, floors, tables, payment methods, coupons, promotions, one customer, and an open session.

## Run the App

Start the backend:

```bash
cd backend
npm start
```

The API runs on:

```text
http://localhost:5000
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The frontend usually runs on:

```text
http://localhost:5173
```

## Available Scripts

Backend:

```bash
npm start      # start Express API
npm run dev    # start API with nodemon
npm run seed   # seed demo database data
```

Frontend:

```bash
npm run dev     # start Vite dev server
npm run build   # production build
npm run lint    # run ESLint
npm run preview # preview production build
```

## Role and Permission Rules

Admin-only actions:

- Create/update/delete categories
- Create/update/delete products
- Create/update/delete floors
- Create/update tables
- Create/update/delete coupons
- Create/update/delete promotions
- Enable/disable payment methods
- Create/archive/restore users

Cashier / employee access:

- Can log in and use POS operations
- Can view products, categories, floors, tables, coupons, promotions, payment methods, customers, orders, KDS, and reports
- Cannot create or modify admin setup data
- If a cashier directly calls an admin-only create/update/delete API, the backend returns `403 You do not have permission`

Signup users are always created as `employee`. Admin accounts must be created by an existing admin or seeded by the database seed script.

## Main API Routes

Auth:

```text
POST /api/auth/login
POST /api/auth/signup
GET  /api/auth/me
```

Bootstrap and setup data:

```text
GET /api/bootstrap
GET /api/products
GET /api/categories
GET /api/floors
GET /api/payment-methods
GET /api/coupons
GET /api/promotions
```

POS:

```text
GET   /api/sessions/open
POST  /api/sessions/:id/close
GET   /api/orders
POST  /api/orders
PATCH /api/orders/:id
POST  /api/orders/:id/send-to-kitchen
POST  /api/orders/:id/pay
POST  /api/orders/:id/cancel
```

Kitchen:

```text
GET   /api/kitchen/tickets
PATCH /api/kitchen/tickets/:id/stage
PATCH /api/kitchen/items/:id
```

Reports:

```text
GET /api/reports/summary
```

Admin users:

```text
GET    /api/users
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
```

## Verification

Useful checks before committing:

```bash
cd backend
node --check app.js

cd ../frontend
npm run lint
npm run build
```

## Notes

- The backend uses SQLite for local development.
- The existing `backend/prisma/dev.db` can be used for quick local testing.
- Do not commit real production secrets in `.env`.
- For production deployment, use a strong `JWT_SECRET`, configure a persistent database, and restrict CORS to your frontend domain.
