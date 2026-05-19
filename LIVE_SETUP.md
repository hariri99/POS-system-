# Live Setup Guide

This guide is for connecting ProteinOS to a real Supabase-backed setup with real accounts, persistent data, and production-style behavior.

## Important

ProteinOS is now real-backend only.

If `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or `SUPABASE_SECRET_KEY` are missing from `.env.local`, the app will stop with a configuration error instead of falling back to demo data.

## Goal

After finishing this guide, you will have:

- a real Supabase project
- real PostgreSQL tables
- a real admin account
- real login through Supabase Auth
- persistent products, inventory, sales, and users

## Step 1: Create a Supabase project

1. Go to `https://supabase.com/dashboard`
2. Sign in or create your Supabase account
3. Click `New project`
4. Choose your organization
5. Enter:
   - project name
   - database password
   - region
6. Wait until the project is fully created

## Step 2: Get your project keys

Inside the Supabase dashboard:

1. Open `Project Settings`
2. Open `API`
3. Copy:
   - `Project URL`
   - `anon public key`
   - `service_role key`

## Step 3: Put the real keys into `.env.local`

Open [\.env.local](</c:/Users/RitaM/OneDrive/Desktop/protein system/.env.local>) and replace it with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Important:

- do not keep these values empty
- do not share the `SUPABASE_SECRET_KEY`

## Step 4: Run all database migrations

In the Supabase dashboard:

1. Open `SQL Editor`
2. Run every file in [supabase/migrations](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/migrations) in timestamp order
3. Create a new query for each file
4. Copy the SQL from the file into the editor
5. Run it before moving to the next file

This creates:

- tables
- enums
- views
- policies
- functions
- storage bucket rules
- later schema upgrades such as pay-later orders and partial product refunds

Important:

- do not stop after only `20260513195000_init.sql`
- [20260518123000_partial_product_refunds.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/migrations/20260518123000_partial_product_refunds.sql) is recommended cleanup for native refund columns, but single-product refunds still work in compatibility mode if it has not been applied yet
- [20260519123000_remove_legacy_sales_workflow_rpcs.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/migrations/20260519123000_remove_legacy_sales_workflow_rpcs.sql) and [20260519131000_remove_legacy_inventory_adjustment_rpc.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/migrations/20260519131000_remove_legacy_inventory_adjustment_rpc.sql) are recommended cleanup only
- the current app already uses direct app-side sales, refunds, unpaid-order, and inventory-adjustment flows, so those cleanup migrations are not required for the working checkout fix you just tested

## Step 5: Run the seed data

Still in `SQL Editor`:

1. Create another query
2. Copy all SQL from [supabase/seed.sql](/c:/Users/RitaM/OneDrive/Desktop/protein%20system/supabase/seed.sql)
3. Run it

This creates:

- the first branch
- starter categories
- brands
- suppliers
- starter products
- starter inventory

## Step 6: Verify the live connection

In PowerShell:

```powershell
cd "C:\Users\RitaM\OneDrive\Desktop\protein system"
npm run verify:live
```

If everything is connected correctly, the script will confirm:

- Supabase is reachable
- your tables exist
- catalog view is readable
- refund handling is either fully migrated or running in compatibility mode
- optional legacy-workflow cleanup migrations are not required for the direct checkout and inventory fixes
- storage bucket status is visible

## Step 7: Create your real admin account

Run:

```powershell
npm run create:admin -- --email owner@example.com --password YourStrongPassword123! --name "Owner Name"
```

Replace:

- `owner@example.com` with your real email
- `YourStrongPassword123!` with your real password
- `Owner Name` with your real name

This creates:

- a real Supabase Auth user
- a `profiles` row
- role = `admin`
- branch assignment to the first seeded branch

## Step 8: Restart the app

If the dev server is already running, stop it:

```powershell
.\stop-local.ps1
```

Then start it again:

```powershell
.\start-local.ps1
```

## Step 9: Log in with your real account

1. Open `http://localhost:3000/login`
2. Enter the email and password you used in Step 7
3. Click `Continue with Supabase Auth`

You should now enter the real admin dashboard.

## Step 10: Confirm it is really live

After logging in:

1. Add a product
2. Refresh the page
3. Confirm the product still exists
4. Make a sale
5. Check that inventory changes remain after refresh
6. Verify that whole-order refunds work
7. Verify that single-product refunds work

If those changes persist, you are using the real backend.

## Step 11: Phone access for testing

If you want to test from your phone on the same Wi-Fi:

- `http://192.168.10.214:3000`

For production later, this will become your Vercel domain, not your local IP.

## Step 12: When ready to sell

Before selling this system to a client, you should still do:

1. Deploy the Next.js app to Vercel
2. Point `NEXT_PUBLIC_APP_URL` to the Vercel domain
3. Add production environment variables in Vercel
4. Create a production Supabase project
5. Re-run every migration and then seed if needed
6. Create production admin accounts
7. Test product creation, sales, inventory deduction, full refunds, single-product refunds, and login/logout one more time
