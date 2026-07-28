# 🎁 GIFTERY — Clean 2-Folder Full-Stack Monorepo

A full-stack e-commerce platform structured cleanly into **`frontend/`** and **`backend/`**.

---

## 📦 Project Structure

```
d:\new\ecommerce-project\
├── frontend/             ← React 18 + Vite + Redux Toolkit + React Router
└── backend/              ← Express + Prisma ORM + Shared Types + Docker setup
```

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js ≥ 20
- PostgreSQL ≥ 14 (or use Docker)
- npm ≥ 10

### 1. Clone and setup

```bash
# Backend
cd backend
cp .env.example .env        # Edit DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev --name init
node prisma/seed.js         # Seeds demo data

# Frontend
cd ../frontend
cp .env.example .env        # Adjust if needed
npm install
```

### 2. Run in development

```bash
# Terminal 1 — Backend
cd backend && npm run dev
# → http://localhost:5000

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:3000
```

---

## 🐳 Docker Compose (All Services)

```bash
# From project root
docker-compose up --build

# Services:
#   postgres  → localhost:5432
#   backend   → localhost:5000
#   frontend  → localhost:3000
```

---

## 🔑 Demo Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@giftery.com | Admin@123 |
| Customer | jane@example.com | User@123 |

---

## 📡 API Reference

Base URL: `http://localhost:5000/api/v1`

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | ✅ | Current user |
| POST | `/auth/logout` | ✅ | Logout |
| PUT | `/auth/change-password` | ✅ | Change password |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | — | List (search, filter, sort, paginate) |
| GET | `/products/:slug` | — | Product detail with reviews |
| POST | `/products` | Admin/Vendor | Create product |
| PUT | `/products/:id` | Admin/Vendor | Update product |
| DELETE | `/products/:id` | Admin | Delete product |

### Cart
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart` | ✅ | Get cart with totals |
| POST | `/cart` | ✅ | Add item |
| PUT | `/cart/:itemId` | ✅ | Update quantity |
| DELETE | `/cart/:itemId` | ✅ | Remove item |
| DELETE | `/cart` | ✅ | Clear cart |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/orders/my` | ✅ | My orders |
| POST | `/orders` | ✅ | Create order from cart |
| GET | `/orders/:id` | ✅ | Order detail |
| GET | `/orders` | Admin | All orders |
| PATCH | `/orders/:id/status` | Admin | Update status |

### Other
| Method | Path | Description |
|---|---|---|
| GET | `/categories` | All categories |
| GET | `/wishlist` | User wishlist |
| POST | `/wishlist` | Add to wishlist |
| DELETE | `/wishlist/:productId` | Remove from wishlist |
| GET | `/reviews/product/:id` | Product reviews |
| POST | `/reviews/product/:id` | Submit review |
| GET | `/dashboard/stats` | Admin stats |
| GET | `/health` | Health check |

---

## 🗂️ Project Structure

```
ecommerce-project/
├── .gitignore
├── docker-compose.yml
├── README.md
├── shared/
│   ├── constants/    (httpStatus, roles, orderStatuses)
│   ├── enums/        (UserRole, OrderStatus, PaymentStatus)
│   └── types/        (JSDoc type definitions)
├── frontend/
│   ├── .env / .env.example
│   ├── vite.config.js
│   └── src/
│       ├── api/          (axiosInstance, endpoints)
│       ├── components/   (layout, ui, product, cart, checkout, auth)
│       ├── config/       (env.js)
│       ├── constants/    (routes, keys, messages)
│       ├── context/      (AuthContext, CartContext, ThemeContext)
│       ├── hooks/        (useAuth, useCart, useFetch, useDebounce, useLocalStorage)
│       ├── pages/        (Home, Shop, Product, Cart, Wishlist, Orders, ...)
│       ├── routes/       (ProtectedRoute)
│       ├── services/     (authService, productService, ...)
│       ├── store/        (Redux store + slices)
│       ├── styles/       (global.css, variables.css, mixins.css)
│       └── utils/        (formatters, validators, storage)
├── backend/
│   ├── .env / .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── config/       (env, db, logger)
│       ├── controllers/  (auth, products, cart, orders, dashboard, ...)
│       ├── helpers/      (email, fileUpload)
│       ├── jobs/         (cleanupTempFiles)
│       ├── middleware/   (auth, validate, errorHandler, rateLimiter, upload)
│       ├── repositories/ (authRepository, productRepository, ...)
│       ├── routes/       (index, authRoutes, productRoutes, ...)
│       ├── services/     (authService, productService, cartService, orderService)
│       ├── sockets/      (Socket.IO init, emitters)
│       ├── utils/        (jwt, response, pagination, slugify)
│       └── validations/  (Zod schemas per resource)
└── docker/
    ├── frontend/Dockerfile
    ├── backend/Dockerfile
    └── postgres/init.sql
```

---

## 🌐 Env Connection Map

```
backend/.env          → PORT=5000, CORS_ORIGIN=http://localhost:3000
frontend/.env         → VITE_API_BASE_URL=http://localhost:5000/api
frontend/vite.config  → proxy /api → http://localhost:5000
frontend/config/env.js → export API_BASE = import.meta.env.VITE_API_BASE_URL
frontend/api/axiosInstance.js → baseURL: API_BASE
```

---

## ✅ Verification Checklist

- [ ] `GET http://localhost:5000/api/v1/health` → `{ "status": "ok" }`
- [ ] `GET http://localhost:5000/api/v1/products` → Array of 10 products
- [ ] `POST http://localhost:5000/api/v1/auth/login` → Returns JWT
- [ ] Frontend at `http://localhost:3000` → No console errors
- [ ] `/profile` redirects to `/login` when unauthenticated
- [ ] Docker Compose: all three containers healthy

---

## 🔒 Security Features

- Helmet.js HTTP headers
- CORS whitelisting
- JWT authentication + role-based authorization
- Express rate limiting (global + auth endpoints)
- Zod request validation
- bcrypt password hashing (12 rounds)
- Multer file type + size validation
- Global error handler (no stack traces in production)
