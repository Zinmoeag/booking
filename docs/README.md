# Hotel Booking API — Documentation

Documentation index for the `booking` backend (Express 5 + Prisma + Zod, TypeScript).

| Document | Contents |
| -------- | -------- |
| [architecture.md](./architecture.md) | Full technical reference — folder layout, module organization, layered controller/service/repository pattern, auth design, error & response contracts, data model, business flows. |
| [user-journey.md](./user-journey.md) | Behavioural reference extracted from the code — actor journeys, booking/payment lifecycles, effective permission matrix, error paths, and the gaps between intent and implementation. Mermaid diagrams. |
| [n8n-telegram-bot.md](./n8n-telegram-bot.md) | The Telegram bot that drives the guest journey — workflow shape, conversation state machine, command reference, setup, and design notes. Workflow lives in [`n8n/`](../n8n/). |
| This file | Getting started, the live API reference, and the request conventions every endpoint shares. |

---

## 1. Getting started

```bash
npm install
npx prisma generate         # required — the Prisma client is not committed
npx prisma migrate dev      # creates ./dev.db and applies migrations
npx prisma db seed          # optional — seeds from src/data/*.json
npm run dev                 # tsx watch, reads .env.development
```

> `npx prisma generate` is not optional. Without it the server fails at startup with
> `Cannot find module '.prisma/client/default'`, because `@prisma/client` only ships the
> wrapper — the generated client is produced from `prisma/schema.prisma`.

Available scripts:

| Script | Command |
| ------ | ------- |
| `npm run dev` | `tsx watch --env-file=.env.development ./src/server.ts` |
| `npm run build` | `rimraf ./dist && tsc && tsc-alias` |
| `npm start` | build, then `NODE_ENV=production node dist/server.js` |

**Database.** SQLite, one file. The path comes from `DATABASE_URL` in `.env`
(`file:./dev.db`), resolved **relative to the working directory** — always run npm scripts
from the repo root or you will silently get a second, empty `dev.db`.

---

## 2. Live API reference (Swagger)

With the server running:

| URL | What |
| --- | ---- |
| <http://localhost:4000/api/docs> | Swagger UI — browse and execute every endpoint |
| <http://localhost:4000/api/docs.json> | Raw OpenAPI 3.0 document |

### How it is generated

The spec is **not hand-maintained**. It is built at boot from the live routing table, so a
route added to a controller appears in the docs with no extra work:

| Source | Produces |
| ------ | -------- |
| `@Controller` / `@RequestMapper` metadata ([route.ts](../src/app/core/route.ts)) | paths, HTTP methods, path params, tags |
| `ValidationMiddleware.validateRequestBody(schema)` | `requestBody` JSON Schema, from the zod schema |
| `ValidationMiddleware.validateRequestQuery(schema)` | `filter` / `orderBy` query parameters |
| `authenticate` in the middleware list | `bearerAuth` security + `401` response |
| `authorize('ADMIN', …)` | required-role description + `403` response |

The wiring lives in [`src/app/core/openapi/`](../src/app/core/openapi/):

- `metadata.ts` — tags middleware functions with their zod schema / required roles so the
  generator can recover them. Tagging is inert at runtime.
- `document.ts` — walks the route registry and emits the OpenAPI document.
- `swagger.ts` — serves the UI and the JSON. Mounted in
  [`src/routes/index.ts`](../src/routes/index.ts) **after** all controllers, since the
  routing table is only complete once every controller has been instantiated.

**Authorizing in the UI:** `POST /api/auth/login`, copy the access token, click
**Authorize** and paste it. It persists across reloads.

### Endpoint groups

| Base path | Module |
| --------- | ------ |
| `/api/auth` | register, login, refresh, me, change-password |
| `/api/users` | profile read/update, admin user management |
| `/api/hotels` | hotel CRUD + filtered list |
| `/api/room-types` | room types per hotel |
| `/api/room-rates` | seasonal / dynamic pricing |
| `/api/rooms` | physical rooms + availability |
| `/api/amenities` | amenity catalog + hotel/room-type assignment |
| `/api/bookings` | booking lifecycle, pricing, guests |
| `/api/payments` | payment records per booking |
| `/api/reviews` | one review per booking, hotel rating aggregation |
| `/health-check` | liveness probe |

---

## 3. Request conventions

### 3.1 Query strings are nested

List endpoints parse the query string with `lodash.set`, so pagination, filtering and
sorting each live under their own **bracketed group**. Flat keys are ignored:

```
GET /api/hotels?pagination[size]=20&pagination[page]=2
GET /api/hotels?filter[city]=Yangon
GET /api/hotels?filter[name][contains]=inn&filter[rating][gte]=4
GET /api/hotels?orderBy[name]=asc
```

`?size=20` does **not** work — it lands outside the `pagination` group and is dropped.

| Group | Shape | Defined in |
| ----- | ----- | ---------- |
| `pagination` | `page` (≥ 1), `size` | [`paginationSchema`](../src/app/core/schema.ts) |
| `filter` | Prisma-style operators per field — `contains`, `startsWith`, `in`, `not`, `gt`, `gte`, `lt`, `lte`, … | each module's `*.schema.ts` |
| `orderBy` | `asc` \| `desc` per field | `makeOrderByQuerySchema` |

Swagger UI models these as `deepObject` parameters, so its **Try it out** form emits the
correct bracketed form for you.

> **Known issue.** `paginationSchema` defaults `size` to `'100'` while validating
> `size < 100`, so the default fails its own rule and any list request without an explicit
> `pagination[size]` returns `422 schema.fit64bitint`. Fix by relaxing the bound to `<= 100`
> or lowering the default.

### 3.2 Authentication

`Authorization: Bearer <accessToken>` — RS256 JWT, 15 minute access token, 7 day refresh
token. See [architecture.md §6](./architecture.md#6-auth--authorization) for the role matrix.

### 3.3 Response envelope

Every response is wrapped. See [`HttpResponse.ts`](../src/app/core/Response/HttpResponse.ts).

| Shape | Used for |
| ----- | -------- |
| `{ result, status, meta: { message } }` | single resource |
| `{ count, result: [], status, meta: { message } }` | collections — `count` is the total matching rows, not the page size |
| `{ message, status, error? }` | acknowledgements and errors |

Errors use the **detail** envelope, so the message is at `meta.message` — there is no top-level
`message` key on an error response:

```json
{ "result": {}, "status": 409, "meta": { "message": "Room is already booked for the selected dates" } }
```

Status codes are mapped from `errorKinds` by `ErrorBase.getStatus()`: `400` bad request, `401`
not authorized, `403` forbidden **and invalid/expired token**, `404` not found, `409` already
exists, `422` validation failed / invalid credentials, `500` internal.

---

## 4. Keeping the docs current

- **Endpoints** update themselves — add a `@RequestMapper` and it appears in Swagger.
- **Request bodies** update themselves — they are read from the zod schema attached to the
  validation middleware. A route with no validation middleware documents no body.
- **Architecture, conventions, business rules** are manual — update
  [architecture.md](./architecture.md) alongside the change.
