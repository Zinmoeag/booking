# Hotel Booking System — Architecture

> Technical reference for the `booking` backend. Covers the current codebase layout, the
> module organization derived from the Prisma schema, the layered (controller / service /
> repository) pattern, auth & authorization, error/response contracts, and development
> workflow.

---

## 1. Overview

- **Stack:** Express 5.1 (TypeScript) + Prisma 7.9 (SQLite via `@prisma/adapter-better-sqlite3`) + Zod + jsonwebtoken + bcrypt + express-rate-limit + winston.
- **Language features:** CommonJS, `tsx` for dev, path alias `@/* → src/*`, decorators + `reflect-metadata` enabled.
- **Pattern decisions (agreed):**
  - New modules use the **decorator `@Controller` / `@RequestMapper`** routing style from `src/app/core/route.ts`.
  - Auth is **consolidated on `JwtService`** (AppConfig-driven RS256 keys) + `bcrypt` hashing.
  - The legacy monolithic `src/routes/bookings.ts` is **refactored into the module pattern**.
  - Full module set is built: auth, user, hotel, roomType, roomRate, room, amenity, booking, payment, review.

---

## 2. Folder Structure

```
booking/
├── prisma/
│   ├── schema.prisma          # 13-model data model (SQLite)
│   └── seed.ts                # seed script (reads src/data/*.json)
├── scripts/                   # build / utility scripts
├── src/
│   ├── server.ts              # entrypoint: dotenv → Bootstrap.init()
│   ├── app/
│   │   ├── bootstrap.ts       # app factory: config, middleware, routes, listen
│   │   ├── config/
│   │   │   ├── app.config.ts      # AppConfig singleton registry
│   │   │   ├── Status.ts          # HTTP status codes
│   │   │   ├── env/               # zod env schema + safe getter
│   │   │   ├── rate-limit/        # global rate-limit config
│   │   │   └── logger/            # HttpLogger / SysLogger (winston)
│   │   ├── core/
│   │   │   ├── route.ts           # @Controller + @RequestMapper decorators
│   │   │   ├── ApiRoute.ts        # abstract ApiRouter (parse/filter/orderBy/pagination helpers)
│   │   │   ├── schema.ts          # reusable zod schemas (filter/orderBy/pagination)
│   │   │   ├── validate_query.ts  # query → Prisma filter/orderBy/pagination builders
│   │   │   └── Response/
│   │   │       └── HttpResponse.ts # HttpDetailResponse / HttpListResponse / HttpGenericResponse
│   │   ├── error/
│   │   │   ├── error.base.ts      # errorKinds + ErrorBase + status mapping
│   │   │   ├── AppError.ts        # AppError.new() factory
│   │   │   └── sys.error.ts       # SysError
│   │   └── helpers/
│   │       ├── JWT/jwt.service.ts # JwtService (sign/verify RS256)
│   │       └── cookies.helper.ts
│   ├── middlewares/
│   │   ├── validationMiddleware.ts # zod body/query validation middleware
│   │   ├── auth.middleware.ts      # ⭐ NEW: authenticate() + authorize(...roles)
│   │   └── middleware.interface.ts
│   ├── modules/                    # ⭐ NEW: per-domain modules (see §3)
│   │   ├── shared/                 # BaseRepository, BaseService, BaseController
│   │   ├── auth/  user/  hotel/  roomType/  roomRate/  room/  amenity/
│   │   ├── booking/  payment/  review/
│   │   └── index.ts                # aggregates all module routers
│   ├── routes/
│   │   └── index.ts                # global router: mounts modules, 404, error handler
│   ├── types/
│   │   └── database.ts             # enums (union types) + core table interfaces
│   ├── utils/
│   │   ├── prisma.ts               # PrismaClient singleton
│   │   ├── Filter.ts               # ApplyFilter / FilterHelper (dynamic where builder)
│   │   ├── pagination/Pagination.ts# Pagination result object
│   │   ├── error-handling/         # catchError / catchErrorAsync / tryAndThrow
│   │   ├── imagelink.ts
│   │   └── auth/                   # legacy JWT utils (superseded by JwtService)
│   └── data/                       # JSON seed data per model
├── docs/architecture.md           # this document
├── dist/                          # build output (tsc + tsc-alias)
└── dev.db                         # SQLite database
```

---

## 3. Module Organization (derived from the schema)

The 13 Prisma models map to 9 modules. Nested/junction tables live inside their owner module.

| Module      | Models            | Purpose                                                              |
| ----------- | ----------------- | -------------------------------------------------------------------- |
| `auth`      | `User` (subset)   | register, login, refresh tokens, current user (`/auth/me`)            |
| `user`      | `User`            | profile read/update, admin user management                            |
| `hotel`     | `Hotel`           | hotel CRUD + list with city/country/rating filters                    |
| `roomType`  | `RoomType`        | room-type CRUD per hotel                                              |
| `roomRate`  | `RoomRate`        | seasonal / dynamic pricing per room type                              |
| `room`      | `Room`            | physical room CRUD + availability                                     |
| `amenity`   | `Amenity`, `HotelAmenity`, `RoomTypeAmenity` | catalog + assignment to hotel / room type          |
| `booking`   | `Booking`, `BookingRoom`, `BookingGuest` | booking lifecycle, pricing, guests                 |
| `payment`   | `Payment`         | payment records per booking                                           |
| `review`    | `Review`          | one review per booking, rating aggregation to hotel                   |

**Module build order (dependency graph):** `auth/user → hotel → roomType → roomRate / room / amenity → booking → payment → review`.

### 3.1 Per-module files

```
src/modules/<module>/
├── <module>.controller.ts    # @Controller decorated class; @RequestMapper routes
├── <module>.service.ts       # business logic (pure; throws AppError)
├── <module>.repository.ts    # prisma data access only
├── <module>.schema.ts        # zod request/response DTOs
├── <module>.types.ts         # module interfaces / DTO types
└── <module>.test.ts          # optional unit tests
```

### 3.2 Shared base classes (`src/modules/shared/`)

- **`BaseRepository<T>`** — generic CRUD against the Prisma delegate (`findUnique`, `findMany`, `create`, `update`, `delete`, `count`).
- **`BaseService<T, CreateDTO, UpdateDTO>`** — generic CRUD service wrapping a repository, with validation + `AppError` handling. Domain services extend it and override/append business logic.
- **`BaseController`** — extends `ApiRouter`; adds shared response helpers that wrap `HttpDetailResponse` / `HttpListResponse`.

---

## 4. Layered Pattern (controller → service → repository)

Each request follows one direction — controllers never touch Prisma; repositories never format responses.

```
HTTP Request
   │
   ▼
Route middleware chain:
   rate-limit → validation (zod) → authenticate → authorize(role)
   │
   ▼
Controller (@RequestMapper method)
   • parse body/params/query via ApiRouter helpers (getParsedBody, getQueryPagination, …)
   • call service
   • respond via HttpDetailResponse / HttpListResponse
   │
   ▼
Service (business logic)
   • orchestrates repositories, computes prices, enforces rules
   • throws AppError.new(errorKinds.*, msg, payload) on failures
   │
   ▼
Repository (Prisma delegate)
   • prisma.<model>.<operation>  ← sole Prisma access point
```

Rules:

1. **Controllers** are thin: parse input, delegate, respond. No business logic.
2. **Services** hold all rules (e.g. booking price calculation, room availability check, booking status transitions).
3. **Repositories** are the only code importing `prisma`; abstract delegate operations for testability.
4. **Validation** via zod schemas in `*.schema.ts`; the validation middleware rejects early with `errorKinds.validationFailed` (422).
5. **Errors** propagate as `AppError` (HTTP mapping in `ErrorBase.getStatus()`) and are rendered once by the global error handler in `src/routes/index.ts`.

---

## 5. Core Conventions

### 5.1 Routing (decorator style)

```ts
@Controller('/api/bookings')
export class BookingController extends BaseController {
  @RequestMapper({ method: 'get', path: '/', middleware: [authenticate] })
  async list(ctx: Context) {
    const pagination = this.getQueryPagination(ctx.request);
    const result = await this.bookingService.list(ctx.request.user!, pagination);
    return ctx.response.json(HttpListResponse.json({ ...result, status: 200 }));
  }
}
```

- `@Controller(basePath)` builds an Express `Router` from `@RequestMapper` metadata.
- `@RequestMapper({ method, path, middleware })` — `method` ∈ `get | post | patch | delete`.
- Each handler receives a `Context { request, response, next }` (or the raw `(req, res, next)` triple).

### 5.2 Validation

- Request bodies/queries validated with zod via `ApiRouter.validateRequest` or the `ValidationMiddleware`.
- Query filtering uses `makeFilterQuerySchema` / `makeOrderByQuerySchema` / `paginationSchema` from `src/app/core/schema.ts`; Prisma-ready `where`/`orderBy`/`skip/take` come from `getQueryFilter` / `getQueryOrderBy` / `getQueryPagination` on `ApiRouter`.
- `ValidationMiddleware.validateRequestBody(schema)` replaces `req.body` with validated output.

### 5.3 Response contracts

| Class                   | Shape                                            | When            |
| ----------------------- | ------------------------------------------------ | --------------- |
| `HttpDetailResponse`    | `{ result, status, meta: { message, … } }`       | single resource |
| `HttpListResponse`      | `{ count, result: [], status, meta: { message } }` | collections    |
| `HttpGenericResponse`   | `{ message, status, error? }`                    | generic ack     |

Pagination metadata (`page`, `size`, `totalCount`, `totalPage`, `nextPage`, …) is produced by the `Pagination` class in `src/utils/pagination/Pagination.ts`.

### 5.4 Error handling

- `AppError.new(errorKinds.<kind>, message, payload?, service?)` — the standard way to raise HTTP errors.
- `errorKinds` (from `src/app/error/error.base.ts`): `badRequest`, `notFound`, `forbidden`, `notAuthorized`, `invalidToken`, `alreadyExist`, `invalidCredential`, `validationFailed`, `internalServerError`, …
- `ErrorBase.getStatus()` maps kind → status code (e.g. `notFound` → 404, `validationFailed` → 422, `notAuthorized` → 401).
- The global handler in `src/routes/index.ts` renders `ErrorBase`, `AppError`, `SysError`, and unexpected `Error` (500) consistently and logs via `HttpLogger`/`SysLogger`.

---

## 6. Auth & Authorization

### 6.1 Design

- **JWT:** RS256, keys registered via `AppConfig` (env: `ACCESS_TOKEN_PRIVATE_KEY`, `ACCESS_TOKEN_PUBLIC_KEY`, `REFRESH_TOKEN_PRIVATE_KEY`, `REFRESH_TOKEN_PUBLIC_KEY`).
- **Service:** `JwtService` (`src/app/helpers/JWT/jwt.service.ts`) — `signToken(PRIVATE_KEY, payload, options)`, `verifyToken(PUBLIC_KEY, token)`. Access token expiry 15m, refresh 7d.
- **Hashing:** `bcrypt` — `hashSync(password, 10)` / `compareSync`.
- **User identity (reconciled):** token payload + `req.user` use the Prisma `User` shape:
  `{ id: string; email: string; role: UserRole }` — **not** the legacy `roleId: number` (stale `src/utils/auth/IUser.ts`).
- The legacy `src/utils/auth/*` JWT utils are superseded by `JwtService`; they are removed once the auth module lands.

### 6.2 Middleware (`src/middlewares/auth.middleware.ts`)

```ts
export async function authenticate(req, res, next) {
  // 1. read Bearer token from Authorization header
  // 2. JwtService.verifyToken('ACCESS_TOKEN_PUBLIC_KEY', token) → payload
  // 3. load user (prisma) → req.user = { id, email, role }
  // 4. next() | AppError.new(errorKinds.notAuthorized, …)
}

export function authorize(...roles: UserRole[]) {
  return (req, res, next) => {
    // req.user.role must be in roles, else AppError.new(errorKinds.forbidden, …)
  };
}
```

Usage on a route:

```ts
@RequestMapper({
  method: 'delete',
  path: '/:id',
  middleware: [authenticate, authorize('ADMIN')],
})
```

Role matrix (default — tune per endpoint):

| Action                     | GUEST | HOTEL_STAFF | ADMIN |
| -------------------------- | :---: | :---------: | :---: |
| Register / Login / Refresh |  ✅   |     ✅      |  ✅   |
| Browse hotels/roomTypes     |  ✅   |     ✅      |  ✅   |
| Create / cancel own booking|  ✅   |     ✅      |  ✅   |
| User CRUD (other users)     |  ❌   |     ❌      |  ✅   |
| Hotel / RoomType / Room / Rate / Amenity writes | ❌ | ✅ | ✅ |
| Booking status transitions (confirm / check-in / out) | ❌ | ✅ | ✅ |
| Payment status, refunds     |  ❌   |     ✅      |  ✅   |

---

## 7. Key Business Flows

### 7.1 Booking creation (transactional)

`POST /api/bookings` (authenticated)

1. Validate body (zod): `hotelId`, `rooms: [{ roomId, checkInDate, checkOutDate, guests: [{ fullName, email?, isPrimary?, idProofNumber? }] }]`, `paymentMethod?`.
2. `prisma.$transaction(async (tx) => { … })`:
   - Verify hotel + user exist; every `roomId` belongs to the hotel.
   - **Availability check:** no existing `BookingRoom` on the same room whose `[checkInDate, checkOutDate)` overlaps and whose booking status ≠ `CANCELLED`.
   - **Price:** per room, pick the applicable `RoomRate` (date range covering check-in) `pricePerNight`; fall back to `RoomType.basePrice`. `totalAmount = Σ nights × pricePerNight`.
   - Generate `bookingCode` (`BK-YYYY-NNNN`, zero-padded, next sequence).
   - Create `Booking` (status `PENDING`) → `BookingRoom[]` (snapshot `pricePerNight`) → `BookingGuest[]`.
   - If `paymentMethod` supplied, create `Payment` (status `PENDING`).
3. Respond 201 with the full booking (rooms + guests + payments).

### 7.2 Booking status lifecycle

`PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT` ; `PENDING/CONFIRMED → CANCELLED`

- Allowed transitions enforced in the service; illegal transitions → `errorKinds.badRequest`.
- `CANCELLED` booking can be re-booked on the same room/dates (availability check ignores cancelled bookings).

### 7.3 Review

- `Review.bookingId` is **unique** → exactly one review per booking.
- Creation requires an authenticated user with a `CHECKED_OUT` booking at the hotel; rating 1–5 (int).
- On create/update/delete, the service recomputes the hotel's `rating` (avg of reviews) and persists it.

---

## 8. Data Model Summary

| Model          | Key fields                                              | Notes                              |
| -------------- | ------------------------------------------------------- | ---------------------------------- |
| `User`         | `email` unique, `passwordHash`, `role` default `GUEST`  | `role` stored as String            |
| `Hotel`        | `city`+`country` index, `rating` default 0              | searchable                         |
| `RoomType`     | `basePrice`, `maxOccupancy`, `bedCount`                 | FK hotelId (cascade)               |
| `RoomRate`     | `startDate`/`endDate`/`pricePerNight`                   | index [roomTypeId, start, end]     |
| `Room`         | `roomNumber` unique per hotel, `status`                 | FK hotelId (cascade), roomTypeId (restrict) |
| `Amenity`      | `name` unique, `category?`                              |                                   |
| `HotelAmenity` | composite PK `[hotelId, amenityId]`                     | junction                          |
| `RoomTypeAmenity` | composite PK `[roomTypeId, amenityId]`               | junction                          |
| `Booking`      | `bookingCode` unique, `totalAmount`, `status`           | FK user/hotel (restrict)           |
| `BookingRoom`  | `checkInDate`/`checkOutDate`, `pricePerNight` snapshot  | index [roomId, dates]              |
| `BookingGuest` | `fullName`, `isPrimary` default false                   | belongs to BookingRoom             |
| `Payment`      | `amount`, `paymentMethod`, `status`, `transactionRef?` unique | FK booking (restrict)        |
| `Review`       | `bookingId` **unique**, `rating` int                    | FK booking (cascade)               |

Enums are stored as strings; the app-level source of truth is the union types in `src/types/database.ts`:

- `UserRole` = `GUEST | HOTEL_STAFF | ADMIN`
- `RoomStatus` = `AVAILABLE | OCCUPIED | MAINTENANCE | CLEANING`
- `BookingStatus` = `PENDING | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED`
- `PaymentStatus` = `PENDING | COMPLETED | FAILED | REFUNDED`
- `PaymentMethod` = `CREDIT_CARD | DEBIT_CARD | PAYPAL | BANK_TRANSFER | CASH`

---

## 9. Configuration & Middleware Pipeline

Order in `Bootstrap.configureApp()`:

1. **Global rate limit** (`express-rate-limit`): 100 req / 15 min per IP (`src/app/config/rate-limit`). Stricter per-route limits may be added on auth endpoints.
2. **CORS** (`cors`, origin `*`, methods GET/POST/PUT/DELETE/OPTIONS/PATCH).
3. **Body parsers** — `express.json()`, `express.urlencoded({ extended: true })`.
4. **Cookie parser** (`cookie-parser`).
5. **Request logging** (`HttpLogger.customeLog` with `x-request-id` / `x-user-id` headers).

Then `registerRoutes()` mounts `src/routes/index.ts` (global router → module routers, 404 handler, error handler).

---

## 10. Environment Variables

Required (validated by `src/app/config/env/env.schema.ts`, registered into `AppConfig`):

| Variable                  | Description                     |
| ------------------------- | ------------------------------- |
| `PORT`                    | HTTP port                       |
| `ACCESS_TOKEN_PRIVATE_KEY`| base64 RS256 private key (access token) |
| `ACCESS_TOKEN_PUBLIC_KEY` | base64 RS256 public key (access token)  |
| `REFRESH_TOKEN_PRIVATE_KEY` | base64 RS256 private key (refresh token) |
| `REFRESH_TOKEN_PUBLIC_KEY` | base64 RS256 public key (refresh token)  |

Env files: `.env.development` (dev), `.env.production` (prod). `AppConfig` throws if any key is missing/undefined.

---

## 11. Development Workflow

```bash
npm install                 # install deps
npx prisma generate         # generate Prisma client
npx prisma migrate dev      # apply schema to dev.db (or npx prisma db push)
npm run seed                # (if defined) seed from src/data/*.json
npm run dev                 # tsx watch --env-file=.env.development ./src/server.ts
npm run build               # rimraf ./dist && tsc && tsc-alias
npm start                   # build + NODE_ENV=production node dist/server.js
npm run lint                # eslint
```

Docker for dev: `Dockerfile.dev` + `docker-compose.dev.yaml`.

---

## 12. Status & Roadmap

| Area               | State                                                     |
| ------------------ | --------------------------------------------------------- |
| Core infra         | ✅ bootstrap, config, error, response, validation, rate limit, JwtService |
| Auth module        | 🔄 to build — consolidate on `JwtService` + bcrypt, add `authenticate`/`authorize`, fix `IUser` |
| Modules            | 🔄 to build — auth, user, hotel, roomType, roomRate, room, amenity, booking, payment, review |
| Legacy cleanup     | 🔄 refactor `src/routes/bookings.ts` → `src/modules/booking/`; remove `src/utils/auth/*` JWT utils |
| Tests              | ⬜ per-module unit tests (service/repository)              |

---

_This document reflects the agreed design; update it as modules are implemented._
