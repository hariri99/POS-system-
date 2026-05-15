import { addDays, startOfDay } from "date-fns";
import {
  archiveDemoProduct,
  createDemoSale,
  getDailySalesPoints,
  getDemoSnapshot,
  getDemoStore,
  adjustDemoInventory,
  upsertDemoProduct,
} from "@/lib/demo-store";
import { hasSupabaseEnv } from "@/lib/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type AlertRecord,
  type AppSession,
  type BrandRecord,
  type CategoryRecord,
  type DashboardSnapshot,
  type EmployeeRecord,
  type InventoryAdjustmentInput,
  type PosSaleInput,
  type ProductMutationInput,
  type ProductRecord,
  type SaleRecord,
  type StockMovementRecord,
  type SupplierRecord,
} from "@/lib/types";

function mapProduct(row: Record<string, unknown>): ProductRecord {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    categoryId: String(row.category_id ?? ""),
    categoryName: String(row.category_name ?? ""),
    brandId: String(row.brand_id ?? ""),
    brandName: String(row.brand_name ?? ""),
    supplierId: String(row.supplier_id ?? ""),
    supplierName: String(row.supplier_name ?? ""),
    flavor: String(row.flavor ?? ""),
    sizeLabel: String(row.size_label ?? ""),
    sku: String(row.sku ?? ""),
    barcode: String(row.barcode ?? ""),
    salePrice: Number(row.sale_price ?? 0),
    costPrice: Number(row.cost_price ?? 0),
    stockQuantity: Number(row.stock_quantity ?? 0),
    reorderPoint: Number(row.reorder_point ?? 0),
    expiryDate: (row.expiry_date as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    isActive: Boolean(row.is_active),
    archivedAt: (row.archived_at as string | null) ?? null,
    updatedAt: String(row.updated_at),
    lastRestockedAt: (row.last_restocked_at as string | null) ?? null,
  };
}

function mapSale(row: Record<string, unknown>): SaleRecord {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    invoiceNumber: String(row.invoice_number),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name ?? "Unknown"),
    status: row.status as SaleRecord["status"],
    paymentMethod: row.payment_method as SaleRecord["paymentMethod"],
    paymentStatus: row.payment_status as SaleRecord["paymentStatus"],
    subtotal: Number(row.subtotal ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    notes: String(row.notes ?? ""),
    customerName: (row.customer_name as string | null) ?? null,
    createdAt: String(row.created_at),
    items: Array.isArray(row.items) ? (row.items as SaleRecord["items"]) : [],
  };
}

function mapEmployee(row: Record<string, unknown>): EmployeeRecord {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    role: row.role as EmployeeRecord["role"],
    branchId: String(row.branch_id ?? ""),
    branchName: String(row.branch_name ?? "Main Branch"),
    phone: String(row.phone ?? ""),
    status: (row.status as EmployeeRecord["status"]) ?? "active",
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    totalSales: Number(row.total_sales ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
    transactionCount: Number(row.transaction_count ?? 0),
  };
}

function mapSupplier(row: Record<string, unknown>): SupplierRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    contactName: String(row.contact_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    notes: String(row.notes ?? ""),
    restockCount: Number(row.restock_count ?? 0),
    activeProducts: Number(row.active_products ?? 0),
  };
}

function mapAlert(row: Record<string, unknown>): AlertRecord {
  return {
    id: String(row.id),
    severity: row.severity as AlertRecord["severity"],
    title: String(row.title),
    message: String(row.message),
    productId: (row.product_id as string | null) ?? null,
    productName: (row.product_name as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function mapStockMovement(row: Record<string, unknown>): StockMovementRecord {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name ?? ""),
    movementType: row.movement_type as StockMovementRecord["movementType"],
    quantityDelta: Number(row.quantity_delta ?? 0),
    previousQuantity: Number(row.previous_quantity ?? 0),
    newQuantity: Number(row.new_quantity ?? 0),
    note: String(row.note ?? ""),
    performedBy: String(row.performed_by ?? ""),
    performedByName: String(row.performed_by_name ?? ""),
    supplierId: (row.supplier_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function normalizeBrandName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function getSupabaseSnapshot(session: AppSession): Promise<DashboardSnapshot> {
  const supabase = await createServerSupabaseClient();

  const [
    productsResult,
    salesResult,
    employeesResult,
    suppliersResult,
    alertsResult,
    movementsResult,
    categoriesResult,
    brandsResult,
    trendResult,
  ] = await Promise.all([
    supabase!
      .from("product_catalog_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("updated_at", { ascending: false }),
    supabase!
      .from("sales_overview_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase!
      .from("employee_performance_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("total_revenue", { ascending: false }),
    supabase!
      .from("supplier_overview_view")
      .select("*")
      .order("name", { ascending: true }),
    supabase!
      .from("alerts_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase!
      .from("stock_movements_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase!.from("categories").select("id, name, slug").order("name"),
    supabase!.from("brands").select("id, name").order("name"),
    supabase!
      .from("sales_daily_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("day", { ascending: true })
      .gte("day", startOfDay(addDays(new Date(), -6)).toISOString()),
  ]);

  const products = (productsResult.data ?? []).map((row) => mapProduct(row));
  const sales = (salesResult.data ?? []).map((row) => mapSale(row));
  const employees = (employeesResult.data ?? []).map((row) => mapEmployee(row));
  const suppliers = (suppliersResult.data ?? []).map((row) => mapSupplier(row));
  const alerts = (alertsResult.data ?? []).map((row) => mapAlert(row));
  const stockMovements = (movementsResult.data ?? []).map((row) => mapStockMovement(row));
  const categories = (categoriesResult.data ?? []) as CategoryRecord[];
  const brands = (brandsResult.data ?? []) as BrandRecord[];
  const salesTrend =
    trendResult.data?.map((row) => ({
      label: new Date(String(row.day)).toLocaleDateString("en-US", {
        weekday: "short",
      }),
      revenue: Number(row.revenue ?? 0),
      transactions: Number(row.transactions ?? 0),
    })) ?? getDailySalesPoints();

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((sale) => sale.createdAt.slice(0, 10) === todayKey);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const todayTransactions = todaySales.length;

  return {
    session,
    summary: {
      todayRevenue,
      todayTransactions,
      averageBasket: todayTransactions ? todayRevenue / todayTransactions : 0,
      activeSkus: products.filter((product) => product.isActive).length,
      lowStockCount: products.filter((product) => product.stockQuantity <= product.reorderPoint)
        .length,
      expiringSoonCount: products.filter((product) => {
        if (!product.expiryDate) {
          return false;
        }

        return new Date(product.expiryDate) <= addDays(new Date(), 30);
      }).length,
      pendingPayments: sales.filter((sale) => sale.paymentStatus === "pending").length,
    },
    salesTrend,
    products,
    sales,
    employees,
    suppliers,
    alerts,
    stockMovements,
    categories,
    brands,
  };
}

export async function getDashboardSnapshot(session: AppSession) {
  if (!hasSupabaseEnv) {
    return getDemoSnapshot(session);
  }

  return getSupabaseSnapshot(session);
}

export async function createSale(input: PosSaleInput, session: AppSession) {
  if (!hasSupabaseEnv) {
    return createDemoSale(input, session);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase!.rpc("process_sale", {
    p_branch_id: session.branchId,
    p_customer_name: input.customerName ?? null,
    p_discount_amount: input.discountAmount ?? 0,
    p_employee_id: session.userId,
    p_items: input.items,
    p_notes: input.notes ?? null,
    p_payment_method: input.paymentMethod,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapSale((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
}

export async function mutateProduct(input: ProductMutationInput, session: AppSession) {
  if (!hasSupabaseEnv) {
    return upsertDemoProduct(input);
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const normalizedBrandName = normalizeBrandName(input.brandName);
  if (!normalizedBrandName) {
    throw new Error("Brand name is required.");
  }

  let resolvedBrandId = input.brandId;

  const existingBrandsResult = await admin.from("brands").select("id, name").order("name");
  if (existingBrandsResult.error) {
    throw new Error(existingBrandsResult.error.message);
  }

  const matchedBrand = (existingBrandsResult.data ?? []).find(
    (brand) => normalizeBrandName(String(brand.name)).toLowerCase() === normalizedBrandName.toLowerCase(),
  );

  if (matchedBrand) {
    resolvedBrandId = String(matchedBrand.id);
  } else {
    const insertedBrandResult = await admin
      .from("brands")
      .insert({ name: normalizedBrandName })
      .select("id")
      .single();

    if (insertedBrandResult.error || !insertedBrandResult.data) {
      throw new Error(insertedBrandResult.error?.message ?? "Unable to create brand.");
    }

    resolvedBrandId = String(insertedBrandResult.data.id);
  }

  const payload = {
    branch_id: session.branchId,
    name: input.name,
    description: input.description ?? "",
    category_id: input.categoryId,
    brand_id: resolvedBrandId,
    supplier_id: input.supplierId || null,
    flavor: input.flavor ?? "",
    size_label: input.sizeLabel ?? "",
    sku: input.sku,
    barcode: input.barcode,
    sale_price: input.salePrice,
    cost_price: input.costPrice,
    expiry_date: input.expiryDate ?? null,
    image_url: input.imageUrl ?? null,
    is_active: input.isActive ?? true,
    archived_at: input.isActive === false ? new Date().toISOString() : null,
  };

  const productResult = input.id
    ? await admin.from("products").update(payload).eq("id", input.id).select("*").single()
    : await admin.from("products").insert(payload).select("*").single();

  if (productResult.error || !productResult.data) {
    throw new Error(productResult.error?.message ?? "Unable to save product.");
  }

  const inventoryResult = await admin.from("inventory").upsert(
    {
      branch_id: session.branchId,
      product_id: productResult.data.id,
      quantity_on_hand: input.stockQuantity,
      reorder_point: input.reorderPoint,
      last_restocked_at: input.stockQuantity > 0 ? new Date().toISOString() : null,
    },
    { onConflict: "branch_id,product_id" },
  );

  if (inventoryResult.error) {
    throw new Error(inventoryResult.error.message);
  }

  const catalogResult = await admin
    .from("product_catalog_view")
    .select("*")
    .eq("id", productResult.data.id)
    .single();

  if (catalogResult.error || !catalogResult.data) {
    throw new Error(catalogResult.error?.message ?? "Unable to fetch saved product.");
  }

  return mapProduct(catalogResult.data);
}

export async function archiveProduct(productId: string) {
  if (!hasSupabaseEnv) {
    return archiveDemoProduct(productId);
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const { data, error } = await admin
    .from("products")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to archive product.");
  }

  const catalogResult = await admin
    .from("product_catalog_view")
    .select("*")
    .eq("id", productId)
    .single();

  if (catalogResult.error || !catalogResult.data) {
    throw new Error(catalogResult.error?.message ?? "Unable to fetch archived product.");
  }

  return mapProduct(catalogResult.data);
}

export async function adjustInventory(input: InventoryAdjustmentInput, session: AppSession) {
  if (!hasSupabaseEnv) {
    return adjustDemoInventory(input, session);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase!.rpc("adjust_inventory", {
    p_actor_id: session.userId,
    p_branch_id: session.branchId,
    p_note: input.note,
    p_product_id: input.productId,
    p_quantity_delta: input.quantityDelta,
    p_supplier_id: input.supplierId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapStockMovement((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
}

export async function getPosProducts(session: AppSession) {
  const snapshot = await getDashboardSnapshot(session);
  return snapshot.products.filter((product) => product.isActive);
}

export function getDemoDataset() {
  return getDemoStore();
}
