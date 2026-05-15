import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n[verify:live] ${message}\n`);
  process.exit(1);
}

if (!url || !anonKey || !serviceRoleKey) {
  fail(
    "Missing Supabase environment variables in .env.local. Please set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkTable(name, query) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${name}: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : data ? 1 : 0;
}

async function main() {
  console.log("\n[verify:live] Checking Supabase connection...\n");

  const branchCount = await checkTable(
    "branches",
    admin.from("branches").select("id", { count: "exact", head: false }).limit(1),
  );
  const categoryCount = await checkTable(
    "categories",
    admin.from("categories").select("id", { count: "exact", head: false }).limit(1),
  );
  const brandCount = await checkTable(
    "brands",
    admin.from("brands").select("id", { count: "exact", head: false }).limit(1),
  );
  const supplierCount = await checkTable(
    "suppliers",
    admin.from("suppliers").select("id", { count: "exact", head: false }).limit(1),
  );
  const productViewCount = await checkTable(
    "product_catalog_view",
    admin.from("product_catalog_view").select("id", { count: "exact", head: false }).limit(1),
  );

  const { data: bucketData, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) {
    throw new Error(`storage: ${bucketError.message}`);
  }

  const bucketNames = bucketData.map((bucket) => bucket.name);

  console.log("[verify:live] Connected successfully.");
  console.log(`[verify:live] branches available: ${branchCount}`);
  console.log(`[verify:live] categories available: ${categoryCount}`);
  console.log(`[verify:live] brands available: ${brandCount}`);
  console.log(`[verify:live] suppliers available: ${supplierCount}`);
  console.log(`[verify:live] catalog rows visible: ${productViewCount}`);
  console.log(
    `[verify:live] storage bucket 'product-images': ${bucketNames.includes("product-images") ? "found" : "missing"}`,
  );
  console.log("\n[verify:live] Supabase is reachable and the app can use a real backend.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : "Unknown verification error."));
