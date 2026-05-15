# ProteinOS Technical Report

## 1. Architecture

### Full system architecture

ProteinOS is a hybrid POS and dashboard platform built around `Next.js` and `Supabase`.

- `Next.js App Router` provides the frontend, server components, route handlers, and layout composition.
- `Supabase Auth` handles authentication and session persistence.
- `Supabase PostgreSQL` stores operational data such as products, inventory, sales, employees, suppliers, logs, and alerts.
- `Supabase Realtime` is used for live synchronization of inventory, sales, and dashboard changes.
- `Vercel` is the intended hosting platform for the Next.js application.
- `Supabase Storage` is used for product image uploads via the `product-images` bucket.

### Main modules

- Authentication and session management
- Role-based routing and permissions
- Product management
- Inventory management
- POS and sales processing
- Supplier management
- Employee performance monitoring
- Dashboard analytics and reporting
- Alerts and operational notifications

### Component interaction

The application is organized around a service layer in `src/lib/platform.ts`.

- Server-rendered pages call service functions to fetch role-aware data snapshots.
- Client components submit operational actions to `Next.js` API routes.
- API routes validate payloads with `zod` and call the same platform service layer.
- The platform service layer talks to Supabase tables and RPC functions when credentials are present.
- If credentials are absent, the same service layer falls back to a local demo store so the application still runs.

This keeps read and write logic centralized and allows the UI to remain consistent across local demo mode and live Supabase mode.

## 2. Database Design

### PostgreSQL schema

The schema is defined in [supabase/migrations/20260513195000_init.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/migrations/20260513195000_init.sql).

### Tables

- `branches`
  Stores the current branch and creates a base for future multi-branch expansion.

- `profiles`
  Maps `auth.users` to business roles and branch membership.

- `categories`
  Product categorization such as whey protein, pre-workout, vitamins, and bars.

- `brands`
  Product brand registry.

- `suppliers`
  Supplier master data including contact information and notes.

- `products`
  Stockable sellable product records with SKU, barcode, pricing, flavor, size, supplier, and expiry details.

- `inventory`
  One row per `branch_id + product_id` with quantity, reorder point, and stock timing fields.

- `sales`
  Transaction header records including invoice number, cashier, totals, payment method, and timestamps.

- `sale_items`
  Line-level transaction details with snapshots of product information at sale time.

- `stock_movements`
  Immutable inventory changes caused by restocks, sales, adjustments, returns, or void operations.

- `alerts`
  System alerts for low stock and inventory exceptions.

- `audit_logs`
  Business-event log for major actions like sales creation and stock adjustments.

- `login_events`
  Login history storage for employee activity tracking.

### Relationships

- `profiles.branch_id -> branches.id`
- `products.branch_id -> branches.id`
- `products.category_id -> categories.id`
- `products.brand_id -> brands.id`
- `products.supplier_id -> suppliers.id`
- `inventory.product_id -> products.id`
- `inventory.branch_id -> branches.id`
- `sales.employee_id -> profiles.id`
- `sales.branch_id -> branches.id`
- `sale_items.sale_id -> sales.id`
- `sale_items.product_id -> products.id`
- `stock_movements.product_id -> products.id`
- `stock_movements.sale_id -> sales.id`
- `stock_movements.performed_by -> profiles.id`
- `stock_movements.supplier_id -> suppliers.id`
- `alerts.product_id -> products.id`
- `audit_logs.actor_id -> profiles.id`
- `login_events.profile_id -> profiles.id`

### Constraints

- Unique invoice numbers
- Unique `branch_id + sku`
- Unique `branch_id + barcode`
- Unique `branch_id + product_id` in inventory
- Non-negative price, quantity, and reorder thresholds
- Enumerated types for role, payment method, payment status, sale status, movement type, and alert severity

### Design decisions

- `products` is modeled as the sellable stock unit rather than separating a deep variant tree. This keeps cashier and inventory workflows simpler while still supporting flavor and size variants.
- `inventory` is separated from `products` to support future multi-branch growth and cleaner stock auditing.
- `sale_items` stores product snapshots so invoices remain historically correct even if product data changes later.
- `stock_movements` acts as the audit trail for every stock-affecting event.

## 3. Supabase Usage

### Authentication

Supabase Auth is the primary production authentication layer.

- `profiles` extends `auth.users` with role and branch metadata.
- The `handle_new_user` trigger creates a profile row after signup.
- Session-aware page protection is handled in `src/lib/auth.ts`.

### Database

Supabase PostgreSQL is used for all business entities. The app expects live data from:

- Core tables for CRUD operations
- Read-focused views for dashboard rendering
- RPC functions for atomic business processes

### Realtime

Realtime support is integrated through `src/components/realtime/realtime-refresh.tsx`.

- Admin overview subscribes to `sales`, `inventory`, and `alerts`
- POS subscribes to `sales` and `inventory`
- On change, the client refreshes the current route so server-rendered data stays current

### Storage

Product image uploads are handled by `POST /api/uploads/product-image`.

- Files are uploaded to the `product-images` bucket
- Public URLs are returned for product association
- Storage policies restrict upload and update to admin users

### Security policies

Row-level security is enabled on business tables.

- Authenticated staff can read operational data for their own branch
- Admins can manage protected records
- Functions like `process_sale` and `adjust_inventory` perform additional role checks inside PostgreSQL

### APIs

Supabase is used through:

- Browser client for sign-in and realtime subscriptions
- Server client for authenticated reads and RPC calls
- Admin/service-role client for controlled product writes and storage uploads

## 4. Frontend Structure

### Dashboard architecture

The UI is split into admin and cashier experiences.

- `src/app/admin/*` contains management surfaces
- `src/app/pos/page.tsx` contains the cashier terminal
- `src/components/shell/app-shell.tsx` provides a role-aware navigation shell

### Page structure

- `/`
  Marketing/entry page with direct access to the platform

- `/login`
  Supabase login or demo login entry

- `/admin`
  Overview with KPIs, alerts, inventory risk, and recent activity

- `/admin/products`
  Product add/edit/archive management

- `/admin/inventory`
  Restock and adjustment operations plus movement history

- `/admin/sales`
  Transaction history and invoice list

- `/admin/suppliers`
  Supplier profiles and contact summary

- `/admin/employees`
  Team performance and login recency

- `/admin/reports`
  KPI and product-performance reporting surface

- `/pos`
  High-speed cashier workflow

### POS flow

The POS screen was intentionally designed for speed:

1. Search or scan product by name, SKU, or barcode
2. Tap product card to add it to the cart
3. Adjust quantity or line discount
4. Select payment method and optional customer/note data
5. Submit sale through the backend route
6. The backend route calls the atomic PostgreSQL sale processor
7. Inventory and movement history are updated automatically

### UI organization

- Shared visual primitives are located in `src/components/ui`
- Domain modules are grouped under `dashboard`, `products`, `inventory`, `pos`, and `auth`
- The visual language uses a darker control-room style with a teal operational accent to feel modern without compromising legibility

## 5. Backend Logic

### Business logic

Business logic is centralized in `src/lib/platform.ts`.

- `getDashboardSnapshot`
  Loads management data for server-rendered pages

- `createSale`
  Calls the `process_sale` RPC in live mode or demo sale processing in local mode

- `mutateProduct`
  Creates or updates catalog records and synchronizes inventory rows

- `adjustInventory`
  Calls the inventory-adjustment RPC or demo adjustment fallback

### Server-side operations

`Next.js` route handlers are used for all client-triggered mutations:

- `/api/products`
- `/api/products/[productId]`
- `/api/inventory/adjustments`
- `/api/pos/sales`
- `/api/uploads/product-image`

### API architecture

Each API route follows the same pattern:

1. Require role-aware session access
2. Parse and validate input using `zod`
3. Call the platform service
4. Return normalized JSON responses

### Transaction handling

Transaction integrity is handled at the database level for the most sensitive operations:

- `process_sale` wraps sale creation, line insertion, stock deduction, movement logging, and alert generation in one PostgreSQL function
- `adjust_inventory` wraps stock mutation, movement logging, and alert generation

This avoids partial writes and keeps inventory trustworthy.

## 6. Inventory Logic

### Stock synchronization

Inventory is updated automatically during POS checkout.

- The cashier submits a sale
- PostgreSQL locks the inventory row
- Stock is decremented
- A stock movement is inserted
- Alerts are generated if stock falls below threshold

### Inventory updates

Manual adjustments are handled through the inventory screen and `adjust_inventory` RPC.

- Positive delta means restock
- Negative delta means correction or shrinkage
- Every change is timestamped and attributed to an actor

### Restock handling

Restocks can optionally reference a supplier so replenishment history remains traceable.

### Stock movement logic

`stock_movements` records:

- Quantity delta
- Previous quantity
- New quantity
- Operation type
- Sale or supplier linkage
- Human-readable note
- Performing employee/admin

This table is central to auditability.

## 7. Security Implementation

### Authentication flow

- Supabase Auth stores the user session
- Server components read the authenticated user through the Supabase server client
- `profiles` enriches auth with role and branch data

### Authorization logic

- `requireRole` protects server-rendered routes
- `requireApiRole` protects mutation endpoints
- PostgreSQL RLS protects data access
- Sensitive RPC functions validate role again inside the database

### Role permissions

Admins:

- Full management access
- Product/inventory/supplier/employee/reporting control
- Storage upload permission

Employees:

- POS access
- Restricted operational visibility
- No product or inventory mutation rights

### Security protections

- Route guarding
- API guarding
- Input validation with `zod`
- RLS on tables
- `security definer` RPC functions with explicit role checks
- Unique identifiers and normalized audit logging

## 8. Reporting System

### Analytics generation

The admin reporting layer is driven by:

- `sales_daily_view`
- `employee_performance_view`
- `supplier_overview_view`
- `product_catalog_view`
- Aggregation logic in server components

### Dashboard statistics

Current KPIs include:

- Today revenue
- Today transactions
- Average basket
- Active SKUs
- Low stock count
- Expiring soon count
- Pending payments

### Reporting calculations

The reporting page derives product revenue estimates from:

- Product sale price
- Quantities sold in sale-item history

This is intentionally modular so future reporting can move deeper into SQL views or materialized views without changing page structure.

## 9. Realtime Architecture

### Realtime subscriptions

Realtime refresh is implemented through Supabase browser subscriptions.

- `RealtimeRefresh` subscribes to one or more tables
- Route refresh is triggered on insert/update/delete events

### Live synchronization

This keeps:

- Inventory counts current
- POS availability accurate across employees
- Dashboard alerts and sales cards fresh

### Multi-user handling

The multi-user approach is based on:

- Shared PostgreSQL state
- Row-level security
- Realtime event fan-out
- Atomic stock-changing RPC functions

This makes simultaneous cashier sessions practical without drifting inventory counts.

## 10. Scalability Considerations

### Future growth support

The architecture was shaped to allow:

- Multi-branch inventory by design
- Customer records and loyalty tables later
- Online ordering with the same stock engine
- Mobile apps consuming the same API routes or Supabase-backed services
- QR/barcode expansion without schema changes
- Forecasting and AI analytics on top of normalized sales and stock history

### Modular design decisions

- Branch separation already exists
- Inventory is decoupled from product definition
- Sale header and line items are normalized
- Audit trails exist for future compliance requirements
- Views abstract the UI away from table joins

## 11. Deployment Overview

### Deployment structure

- Deploy the Next.js app to Vercel
- Host PostgreSQL, Auth, Realtime, and Storage on Supabase

### Hosting setup

Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Supabase setup:

- Run migration
- Run seed
- Configure Auth users
- Confirm storage bucket policies

### Environment configuration

An `.env.example` file is provided at [.env.example](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/.env.example).

### Production considerations

- Rotate service-role keys securely
- Keep `NEXT_PUBLIC_APP_URL` aligned with the Vercel production domain
- Consider adding server-side logging/monitoring such as Sentry
- Consider materialized views or background jobs if analytics scale grows significantly

## 12. Challenges and Solutions

### Technical challenges encountered

- The project started from an empty workspace
- The required scope was broad: POS, inventory, analytics, suppliers, employees, auth, and reporting
- The system needed to remain both deployable and testable without live Supabase credentials

### Architectural problems solved

- A dual-mode service layer was introduced so the same UI works in demo mode and in live Supabase mode
- Critical stock updates were moved into PostgreSQL RPC functions for atomic consistency
- Read-heavy UI pages were decoupled from raw tables via views

### Major implementation decisions

- Keep product variants flattened into sellable product rows for speed and simplicity
- Use route handlers for mutations and server components for most reads
- Use a custom shell rather than a generic admin template so the POS/dashboard split stays intentional

## 13. Final Summary

### What was built

A responsive, production-oriented supplement-store platform was built with:

- Next.js frontend and backend architecture
- Supabase/PostgreSQL data model
- Supabase Auth-ready role system
- Fast POS terminal
- Product management
- Inventory management
- Supplier and employee monitoring
- Reporting dashboards
- Realtime refresh hooks
- Deployment documentation

### How the system operates

- Users authenticate through Supabase Auth in production
- Admins access the full command dashboard
- Employees use the POS terminal
- Sales write through validated API routes into atomic database functions
- Inventory updates immediately after sales or manual adjustments
- Alerts and analytics are derived from normalized operational data

### How modules interact

- UI pages call the platform service
- The platform service talks to Supabase tables, views, storage, and RPC functions
- Realtime subscriptions refresh active screens when business data changes

### Maintenance and expansion guidance

- Keep new feature modules aligned with the service-layer pattern
- Prefer views or RPC functions for complex data shaping and critical mutations
- Extend branch support before duplicating logic for new locations
- Add customer, loyalty, or online ordering modules on top of the existing normalized sales/inventory structure

