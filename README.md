# ProteinOS

ProteinOS is a modern web-based POS and inventory management platform for supplement retail. It is built with `Next.js`, `Supabase`, `PostgreSQL`, and a responsive dashboard/POS interface designed for fast cashier usage and production deployment on `Vercel + Supabase`.

## Demo vs live

- `Demo mode` happens only when Supabase environment variables are missing. In that mode, the app uses temporary fake data so you can explore the UI.
- `Live mode` starts as soon as you connect a real Supabase project and create a real admin account.

For the full real-account setup, use [LIVE_SETUP.md](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/LIVE_SETUP.md).

## Stack

- Frontend: `Next.js` App Router
- Backend: `Next.js` route handlers and server components
- Database: `Supabase PostgreSQL`
- Auth: `Supabase Auth`
- Realtime: `Supabase Realtime`
- Hosting target: `Vercel` + `Supabase`
- Styling: Tailwind CSS v4 with a custom responsive UI system

## Main capabilities

- Admin and employee role separation
- Fast POS terminal with cart, discounts, totals, and sale completion
- Product catalog management with pricing, SKU, barcode, stock, and expiry fields
- Inventory adjustments and movement logs
- Sales history and invoice tracking
- Supplier and employee management views
- Reporting and KPI dashboards
- Supabase-ready database schema with RLS, views, and RPC functions
- Demo mode fallback when Supabase credentials are not yet configured

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
cp .env.example .env.local
```

3. Add your Supabase credentials to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run the app:

```bash
npm run dev
```

If Supabase credentials are missing, the app runs in demo mode with seeded in-memory data so the full UI and workflow remain explorable.

## Quick local access

The fastest way to open the app locally is:

```powershell
.\start-local.ps1
```

Then open:

- `http://localhost:3000` on this computer
- `http://192.168.10.214:3000` from your phone if it is on the same Wi-Fi network

To stop the local server:

```powershell
.\stop-local.ps1
```

### Demo access flow

If Supabase keys are not configured, the app uses demo mode automatically.

1. Open `/login`
2. Click `Launch admin demo` for the full dashboard
3. Or click `Launch cashier demo` for the POS-only experience

### Live Supabase access flow

Once you add real Supabase credentials to `.env.local`:

1. Restart the dev server
2. Open `/login`
3. Sign in with a Supabase Auth user
4. Make sure at least one user has the `admin` role in `profiles`

## Supabase setup

1. Create a new Supabase project.
2. Run the SQL migration from [supabase/migrations/20260513195000_init.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/migrations/20260513195000_init.sql).
3. Run the seed file from [supabase/seed.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/seed.sql).
4. Create at least one admin user in Supabase Auth and set `raw_user_meta_data.role = "admin"` if needed.
5. Ensure the `product-images` storage bucket exists. The migration attempts to create it automatically.

## Important routes

- `/` Landing page
- `/login` Auth entry
- `/admin` Admin overview
- `/admin/products` Product management
- `/admin/inventory` Inventory operations
- `/admin/sales` Sales history
- `/admin/suppliers` Supplier management
- `/admin/employees` Employee monitoring
- `/admin/reports` Reporting dashboard
- `/pos` Cashier terminal

## API routes

- `POST /api/auth/demo-login`
- `POST /api/auth/logout`
- `GET /api/health`
- `POST /api/products`
- `DELETE /api/products/[productId]`
- `POST /api/inventory/adjustments`
- `POST /api/pos/sales`
- `GET /api/reports/summary`
- `POST /api/uploads/product-image`

## Notes

- Sale processing is designed around the `process_sale` PostgreSQL RPC for atomic stock deduction and movement logging.
- Inventory adjustments use the `adjust_inventory` RPC for controlled stock mutations.
- Realtime refresh components are wired for Supabase live updates on sales, inventory, and alerts.
- Use `npm run verify:live` after adding your real Supabase keys.
- Use `npm run create:admin -- --email owner@example.com --password YourStrongPassword123! --name "Owner Name"` to create the first real admin account.
- A full architecture and maintenance report is available in [TECHNICAL_REPORT.md](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/TECHNICAL_REPORT.md).
