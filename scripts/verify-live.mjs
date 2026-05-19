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

const PARTIAL_REFUND_MIGRATION_PATH =
  "supabase/migrations/20260518123000_partial_product_refunds.sql";
const OPTIONAL_CLEANUP_MIGRATIONS = [
  "supabase/migrations/20260519123000_remove_legacy_sales_workflow_rpcs.sql",
  "supabase/migrations/20260519131000_remove_legacy_inventory_adjustment_rpc.sql",
];

async function checkTable(name, query) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${name}: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : data ? 1 : 0;
}

function isMissingColumnError(message, columnName) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(columnName.toLowerCase()) &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find the") ||
      normalized.includes("column"))
  );
}

async function verifyRefundSchema() {
  const [salesProbe, saleItemsProbe] = await Promise.all([
    admin.from("sales").select("id, refunded_amount").limit(1),
    admin.from("sale_items").select("id, refunded_quantity, refunded_at, refund_reason").limit(1),
  ]);

  const salesRefundReady =
    !salesProbe.error || !isMissingColumnError(salesProbe.error.message, "refunded_amount");
  const saleItemsRefundReady =
    !saleItemsProbe.error ||
    (!isMissingColumnError(saleItemsProbe.error.message, "refunded_quantity") &&
      !isMissingColumnError(saleItemsProbe.error.message, "refunded_at") &&
      !isMissingColumnError(saleItemsProbe.error.message, "refund_reason"));

  const compatibilityMode = !salesRefundReady || !saleItemsRefundReady;

  if (salesProbe.error && salesRefundReady) {
    throw new Error(`refund schema: ${salesProbe.error.message}`);
  }

  if (saleItemsProbe.error && saleItemsRefundReady) {
    throw new Error(`refund schema: ${saleItemsProbe.error.message}`);
  }

  return compatibilityMode
    ? `compatibility mode active; ${PARTIAL_REFUND_MIGRATION_PATH} is recommended cleanup for native refund columns, but not required for the current refund flow`
    : "native schema ready for full-order and single-product refunds";
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

  const refundSchemaStatus = await verifyRefundSchema();

  const bucketNames = bucketData.map((bucket) => bucket.name);

  console.log("[verify:live] Connected successfully.");
  console.log(`[verify:live] branches available: ${branchCount}`);
  console.log(`[verify:live] categories available: ${categoryCount}`);
  console.log(`[verify:live] brands available: ${brandCount}`);
  console.log(`[verify:live] suppliers available: ${supplierCount}`);
  console.log(`[verify:live] catalog rows visible: ${productViewCount}`);
  console.log(`[verify:live] refund schema: ${refundSchemaStatus}`);
  console.log(
    `[verify:live] optional cleanup migrations: ${OPTIONAL_CLEANUP_MIGRATIONS.join(", ")} are recommended, but not required for the direct checkout or inventory fixes`,
  );
  console.log(
    `[verify:live] storage bucket 'product-images': ${bucketNames.includes("product-images") ? "found" : "missing"}`,
  );
  console.log("\n[verify:live] Supabase is reachable and the app can use a real backend.\n");
}

main().catch((error) => fail(error instanceof Error ? error.message : "Unknown verification error."));
