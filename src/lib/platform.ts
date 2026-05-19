import { addDays, startOfDay } from "date-fns";
import { after } from "next/server";
import { assertSupabaseConfigured } from "@/lib/env";
import {
  getRefundableQuantity,
  getRefundedQuantity,
  getSaleRefundedAmount,
  isRefundableStatus,
} from "@/lib/sale-math";
import { buildDashboardSummary } from "@/lib/reporting";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type AlertRecord,
  type AppSession,
  type BrandRecord,
  type CategoryRecord,
  type DashboardSnapshot,
  type EmployeeRecord,
  type ExpenseRecord,
  type InventoryAdjustmentInput,
  type PosSaleInput,
  type ProductMutationInput,
  type ProductRecord,
  type RefundEventRecord,
  type SaleItemRecord,
  type SaleRefundInput,
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
    wholesalePrice: Number(row.wholesale_price ?? row.sale_price ?? 0),
    discountPrice: row.discount_price == null ? null : Number(row.discount_price),
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

function mapSaleItem(row: Record<string, unknown>): SaleItemRecord {
  return {
    id: String(row.id),
    productId: String(row.productId ?? row.product_id ?? ""),
    productName: String(row.productName ?? row.product_name_snapshot ?? ""),
    sku: String(row.sku ?? row.sku_snapshot ?? ""),
    barcode: String(row.barcode ?? row.barcode_snapshot ?? ""),
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unitPrice ?? row.unit_price ?? 0),
    pricingTier: (row.pricingTier ?? row.pricing_tier ?? "retail") as SaleItemRecord["pricingTier"],
    unitCost: Number(row.unitCost ?? row.unit_cost ?? 0),
    discountAmount: Number(row.discountAmount ?? row.discount_amount ?? 0),
    lineTotal: Number(row.lineTotal ?? row.total_line_amount ?? 0),
    lineProfit: Number(row.lineProfit ?? row.profit_amount ?? 0),
    refundedQuantity: Number(row.refundedQuantity ?? row.refunded_quantity ?? 0),
    refundedAt: (row.refundedAt as string | null) ?? (row.refunded_at as string | null) ?? null,
    refundReason:
      (row.refundReason as string | null) ?? (row.refund_reason as string | null) ?? null,
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
    paidAt: (row.paid_at as string | null) ?? null,
    refundedAmount: Number(row.refunded_amount ?? row.refundedAmount ?? 0),
    refundedAt: (row.refunded_at as string | null) ?? null,
    refundReason: (row.refund_reason as string | null) ?? null,
    items: Array.isArray(row.items)
      ? row.items.map((item) => mapSaleItem(item as Record<string, unknown>))
      : [],
    refundEvents: [],
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

function mapExpense(row: Record<string, unknown>): ExpenseRecord {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    category: row.category as ExpenseRecord["category"],
    label: String(row.label),
    amount: Number(row.amount ?? 0),
    notes: String(row.notes ?? ""),
    incurredOn: String(row.incurred_on),
    recurring: Boolean(row.recurring),
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

function isMissingColumnError(message: string, columnName: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(columnName.toLowerCase()) &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find the") ||
      normalized.includes("column"))
  );
}

function isMissingRelationError(message: string, relationName: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(relationName.toLowerCase()) &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("relation") ||
      normalized.includes("does not exist"))
  );
}

type ProductColumnSupport = {
  wholesalePrice: boolean;
  discountPrice: boolean;
};

type SaleColumnSupport = {
  paidAt: boolean;
  saleItemsExtendedFinancials: boolean;
};

type RefundSchemaSupport = {
  salesRefundAmount: boolean;
  saleItemsRefundState: boolean;
};

type RefundAuditEntry = {
  id: string;
  actorId: string | null;
  createdAt: string;
  refundReason: string | null;
  refundTotal: number | null;
  refundedItems: Array<{
    itemId: string;
    quantity: number | null;
  }>;
};

export type RefundCapabilities = {
  fullOrderRefunds: boolean;
  partialItemRefunds: boolean;
  migrationPath: string | null;
  message: string | null;
};

let productColumnSupportPromise: Promise<ProductColumnSupport> | null = null;
let saleColumnSupportPromise: Promise<SaleColumnSupport> | null = null;
let refundSchemaSupportPromise: Promise<RefundSchemaSupport> | null = null;

const PARTIAL_REFUND_MIGRATION_PATH =
  "supabase/migrations/20260518123000_partial_product_refunds.sql";
const PARTIAL_REFUND_COMPATIBILITY_MESSAGE =
  `Single-product refunds are running in compatibility mode. Applying ${PARTIAL_REFUND_MIGRATION_PATH} is still recommended for native database support.`;

async function detectProductColumnSupport(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  const support: ProductColumnSupport = {
    wholesalePrice: true,
    discountPrice: true,
  };

  const [wholesaleProbe, discountProbe] = await Promise.all([
    admin.from("products").select("id, wholesale_price").limit(1),
    admin.from("products").select("id, discount_price").limit(1),
  ]);

  if (wholesaleProbe.error) {
    if (isMissingColumnError(wholesaleProbe.error.message, "wholesale_price")) {
      support.wholesalePrice = false;
    } else {
      console.error("[mutateProduct] Unable to probe products.wholesale_price", wholesaleProbe.error);
    }
  }

  if (discountProbe.error) {
    if (isMissingColumnError(discountProbe.error.message, "discount_price")) {
      support.discountPrice = false;
    } else {
      console.error("[mutateProduct] Unable to probe products.discount_price", discountProbe.error);
    }
  }

  return support;
}

async function detectRefundSchemaSupport(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  const support: RefundSchemaSupport = {
    salesRefundAmount: true,
    saleItemsRefundState: true,
  };

  const [salesProbe, saleItemsProbe] = await Promise.all([
    admin.from("sales").select("id, refunded_amount").limit(1),
    admin.from("sale_items").select("id, refunded_quantity, refunded_at, refund_reason").limit(1),
  ]);

  if (salesProbe.error) {
    if (isMissingColumnError(salesProbe.error.message, "refunded_amount")) {
      support.salesRefundAmount = false;
    } else {
      console.error(
        "[refunds] Unable to probe sales.refunded_amount",
        salesProbe.error,
      );
    }
  }

  if (saleItemsProbe.error) {
    if (
      isMissingColumnError(saleItemsProbe.error.message, "refunded_quantity") ||
      isMissingColumnError(saleItemsProbe.error.message, "refunded_at") ||
      isMissingColumnError(saleItemsProbe.error.message, "refund_reason")
    ) {
      support.saleItemsRefundState = false;
    } else {
      console.error(
        "[refunds] Unable to probe sale_items refund columns",
        saleItemsProbe.error,
      );
    }
  }

  return support;
}

async function detectSaleColumnSupport(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  const support: SaleColumnSupport = {
    paidAt: true,
    saleItemsExtendedFinancials: true,
  };

  const [salesProbe, saleItemsProbe] = await Promise.all([
    admin.from("sales").select("id, paid_at").limit(1),
    admin.from("sale_items").select("id, pricing_tier, unit_cost, profit_amount").limit(1),
  ]);

  if (salesProbe.error) {
    if (isMissingColumnError(salesProbe.error.message, "paid_at")) {
      support.paidAt = false;
    } else {
      console.error("[sales] Unable to probe sales.paid_at", salesProbe.error);
    }
  }

  if (saleItemsProbe.error) {
    if (
      isMissingColumnError(saleItemsProbe.error.message, "pricing_tier") ||
      isMissingColumnError(saleItemsProbe.error.message, "unit_cost") ||
      isMissingColumnError(saleItemsProbe.error.message, "profit_amount")
    ) {
      support.saleItemsExtendedFinancials = false;
    } else {
      console.error("[sales] Unable to probe sale_items extended financial columns", saleItemsProbe.error);
    }
  }

  return support;
}

async function getProductColumnSupport(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  if (!productColumnSupportPromise) {
    productColumnSupportPromise = detectProductColumnSupport(admin).catch((error) => {
      productColumnSupportPromise = null;
      throw error;
    });
  }

  return productColumnSupportPromise;
}

async function getSaleColumnSupport(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  if (!saleColumnSupportPromise) {
    saleColumnSupportPromise = detectSaleColumnSupport(admin).catch((error) => {
      saleColumnSupportPromise = null;
      throw error;
    });
  }

  return saleColumnSupportPromise;
}

async function getRefundSchemaSupport(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  if (!refundSchemaSupportPromise) {
    refundSchemaSupportPromise = detectRefundSchemaSupport(admin).catch((error) => {
      refundSchemaSupportPromise = null;
      throw error;
    });
  }

  return refundSchemaSupportPromise;
}

export async function getRefundCapabilities(): Promise<RefundCapabilities> {
  assertSupabaseConfigured();
  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const refundSchemaSupport = await getRefundSchemaSupport(admin);
  const usingNativeRefundSchema =
    refundSchemaSupport.salesRefundAmount && refundSchemaSupport.saleItemsRefundState;

  return {
    fullOrderRefunds: true,
    partialItemRefunds: true,
    migrationPath: usingNativeRefundSchema ? null : PARTIAL_REFUND_MIGRATION_PATH,
    message: usingNativeRefundSchema ? null : PARTIAL_REFUND_COMPATIBILITY_MESSAGE,
  };
}

function mapRefundAuditEntry(row: Record<string, unknown>): RefundAuditEntry | null {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  const refundedItems = Array.isArray(payload.refunded_items)
    ? payload.refunded_items
        .map((value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return null;
          }

          const item = value as Record<string, unknown>;
          const itemId = item.sale_item_id ?? item.item_id ?? item.id;
          if (!itemId) {
            return null;
          }

          return {
            itemId: String(itemId),
            quantity:
              typeof item.quantity === "number" && Number.isFinite(item.quantity)
                ? Number(item.quantity)
                : null,
          };
        })
        .filter((value): value is { itemId: string; quantity: number | null } => value !== null)
    : Array.isArray(payload.refunded_item_ids)
      ? payload.refunded_item_ids.map((value) => ({
          itemId: String(value),
          quantity: null,
        }))
      : [];

  if (refundedItems.length === 0 && row.action !== "refunded") {
    return null;
  }

  return {
    id: String(row.id ?? crypto.randomUUID()),
    actorId: row.actor_id ? String(row.actor_id) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    refundReason:
      typeof payload.refund_reason === "string" && payload.refund_reason.trim().length > 0
        ? payload.refund_reason
        : null,
    refundTotal:
      typeof payload.refund_total === "number" && Number.isFinite(payload.refund_total)
        ? Number(payload.refund_total)
        : null,
    refundedItems,
  };
}

function buildRefundEvents(
  sale: SaleRecord,
  auditEntries: RefundAuditEntry[],
  actorNames: Map<string, string>,
): RefundEventRecord[] {
  if (auditEntries.length === 0) {
    return sale.refundEvents;
  }

  const saleItemsById = new Map(sale.items.map((item) => [item.id, item]));

  return auditEntries.map((entry) => {
    const items = entry.refundedItems
      .map((refundedItem) => {
        const saleItem = saleItemsById.get(refundedItem.itemId);
        if (!saleItem) {
          return null;
        }

        const quantity = refundedItem.quantity ?? saleItem.quantity;
        return {
          saleItemId: saleItem.id,
          productName: saleItem.productName,
          quantity,
          amount: saleItem.quantity > 0 ? (saleItem.lineTotal / saleItem.quantity) * quantity : 0,
        };
      })
      .filter((item): item is RefundEventRecord["items"][number] => item !== null);

    const amount =
      entry.refundTotal ??
      items.reduce((sum, item) => {
        return sum + item.amount;
      }, 0);

    return {
      id: entry.id,
      actorId: entry.actorId,
      actorName:
        entry.actorId && actorNames.has(entry.actorId)
          ? actorNames.get(entry.actorId) ?? "System"
          : "System",
      createdAt: entry.createdAt,
      reason: entry.refundReason,
      amount,
      items,
    };
  });
}

function applyCompatibilityRefundState(
  sale: SaleRecord,
  auditEntries: RefundAuditEntry[],
): SaleRecord {
  if (auditEntries.length === 0 && sale.paymentStatus !== "refunded") {
    return sale;
  }

  const itemRefundMeta = new Map<
    string,
    { refundedAt: string; refundReason: string | null; refundedQuantity: number }
  >();
  let latestRefundAt = sale.refundedAt;
  let latestRefundReason = sale.refundReason;

  for (const entry of auditEntries) {
    latestRefundAt = entry.createdAt;
    if (entry.refundReason) {
      latestRefundReason = entry.refundReason;
    }

    for (const refundedItem of entry.refundedItems) {
      const existingMeta = itemRefundMeta.get(refundedItem.itemId);
      const nextQuantity = (existingMeta?.refundedQuantity ?? 0) + (refundedItem.quantity ?? 0);

      itemRefundMeta.set(refundedItem.itemId, {
        refundedAt: entry.createdAt,
        refundReason: entry.refundReason,
        refundedQuantity: nextQuantity,
      });
    }
  }

  const nextItems = sale.items.map((item) => {
    if (sale.paymentStatus === "refunded") {
      return {
        ...item,
        refundedQuantity: item.quantity,
        refundedAt: item.refundedAt ?? latestRefundAt ?? sale.createdAt,
        refundReason: item.refundReason ?? latestRefundReason ?? null,
      };
    }

    const refundMeta = itemRefundMeta.get(item.id);
    if (!refundMeta) {
      return item;
    }

    const refundedQuantity =
      refundMeta.refundedQuantity > 0
        ? Math.min(item.quantity, refundMeta.refundedQuantity)
        : item.quantity;

    return {
      ...item,
      refundedQuantity,
      refundedAt: item.refundedAt ?? refundMeta.refundedAt,
      refundReason: item.refundReason ?? refundMeta.refundReason ?? latestRefundReason ?? null,
    };
  });

  const refundedUnits = nextItems.reduce((sum, item) => sum + getRefundedQuantity(item), 0);
  if (refundedUnits === 0 && sale.paymentStatus !== "refunded") {
    return sale;
  }

  const refundedAmount = nextItems.reduce((sum, item) => {
    if (item.quantity <= 0) {
      return sum;
    }

    return sum + (item.lineTotal / item.quantity) * item.refundedQuantity;
  }, 0);
  const fullyRefunded = nextItems.every((item) => item.refundedQuantity >= item.quantity);

  const nextPaymentStatus: SaleRecord["paymentStatus"] = fullyRefunded
    ? "refunded"
    : "partially_refunded";

  return {
    ...sale,
    paymentStatus: nextPaymentStatus,
    refundedAmount: Math.max(sale.refundedAmount, refundedAmount),
    refundedAt: sale.refundedAt ?? latestRefundAt,
    refundReason: sale.refundReason ?? latestRefundReason,
    items: nextItems,
  };
}

async function enrichSalesWithCompatibilityRefunds(
  sales: SaleRecord[],
  branchId: string,
  client: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
) {
  if (sales.length === 0) {
    return sales;
  }

  const saleIds = [...new Set(sales.map((sale) => sale.id))];
  const auditClient = createAdminSupabaseClient() ?? client;
  const { data, error } = await auditClient
    .from("audit_logs")
    .select("id, entity_id, actor_id, action, payload, created_at")
    .eq("branch_id", branchId)
    .eq("entity_type", "sale")
    .eq("action", "refunded")
    .in("entity_id", saleIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[refunds] Unable to read compatibility refund audit logs", error);
    return sales;
  }

  const entriesBySaleId = new Map<string, RefundAuditEntry[]>();
  const actorIds = new Set<string>();
  for (const row of data ?? []) {
    const saleId = String(row.entity_id ?? "");
    if (!saleId) {
      continue;
    }

    const entry = mapRefundAuditEntry(row as Record<string, unknown>);
    if (!entry) {
      continue;
    }

    const existingEntries = entriesBySaleId.get(saleId) ?? [];
    existingEntries.push(entry);
    entriesBySaleId.set(saleId, existingEntries);
    if (entry.actorId) {
      actorIds.add(entry.actorId);
    }
  }

  const actorNames = new Map<string, string>();
  if (actorIds.size > 0) {
    const { data: profileRows, error: profilesError } = await auditClient
      .from("profiles")
      .select("id, full_name")
      .in("id", [...actorIds]);

    if (profilesError) {
      console.error("[refunds] Unable to resolve refund actors", profilesError);
    } else {
      for (const row of profileRows ?? []) {
        actorNames.set(String(row.id), String(row.full_name ?? "Unknown"));
      }
    }
  }

  return sales.map((sale) => {
    const auditEntries = entriesBySaleId.get(sale.id) ?? [];
    const enrichedSale = applyCompatibilityRefundState(sale, auditEntries);
    return {
      ...enrichedSale,
      refundEvents: buildRefundEvents(enrichedSale, auditEntries, actorNames),
    };
  });
}

async function readSaleById(saleId: string, branchId: string) {
  const admin = createAdminSupabaseClient();
  const client = admin ?? (await createServerSupabaseClient());

  if (!client) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await client
    .from("sales_overview_view")
    .select("*")
    .eq("branch_id", branchId)
    .eq("id", saleId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Sale not found.");
  }

  const [sale] = await enrichSalesWithCompatibilityRefunds([mapSale(data as Record<string, unknown>)], branchId, client);
  return sale;
}

async function appendAuditLog(
  branchId: string,
  actorId: string,
  entityId: string,
  action: string,
  payload: Record<string, unknown>,
  entityType = "sale",
) {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return;
  }

  await admin.from("audit_logs").insert({
    branch_id: branchId,
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    payload,
  });
}

function getTrimmedRefundReason(reason: string | undefined) {
  const trimmedReason = reason?.trim();
  return trimmedReason ? trimmedReason : undefined;
}

function buildRefundMovementNote(invoiceNumber: string, refundReason: string | undefined) {
  return refundReason
    ? `Refunded sale ${invoiceNumber}: ${refundReason}`
    : `Refunded sale ${invoiceNumber}`;
}

function getRequestedRefundQuantity(item: SaleItemRecord, input: SaleRefundInput) {
  const refundableQuantity = getRefundableQuantity(item);
  if (input.scope !== "item") {
    return refundableQuantity;
  }

  const requestedQuantity = Math.trunc(input.quantity ?? refundableQuantity);
  return Math.min(Math.max(requestedQuantity, 1), refundableQuantity);
}

function buildRefundCompatibilityNotes(
  existingNotes: string,
  invoiceNumber: string,
  refundReason: string | undefined,
) {
  const refundSummary = buildRefundMovementNote(invoiceNumber, refundReason);
  const trimmedNotes = existingNotes.trim();
  return trimmedNotes ? `${trimmedNotes}\n\n${refundSummary}` : refundSummary;
}

function getSaleSortDate(sale: SaleRecord) {
  return sale.refundedAt ?? sale.paidAt ?? sale.createdAt;
}

function generateFastInvoiceNumber() {
  const timestamp = Date.now().toString();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `INV-${timestamp.slice(-8)}-${suffix}`;
}

async function createDirectSupabaseSale(input: PosSaleInput, session: AppSession) {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }
  const saleColumnSupport = await getSaleColumnSupport(admin);
  const trimmedCustomerName = input.customerName?.trim();
  const customerName = trimmedCustomerName ? trimmedCustomerName : null;
  const notes = input.notes ?? "";

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const productsResult = await admin
    .from("product_catalog_view")
    .select(
      "id, branch_id, name, flavor, sku, barcode, sale_price, cost_price, is_active, stock_quantity, reorder_point",
    )
    .eq("branch_id", session.branchId)
    .in("id", productIds);

  if (productsResult.error) {
    throw new Error(productsResult.error.message);
  }

  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [String(product.id), product]),
  );

  const normalizedItems = input.items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product || !product.is_active) {
      throw new Error("Product is missing or inactive.");
    }

    const quantity = Math.max(1, item.quantity);
    const discountAmount = Math.max(0, item.discountAmount);
    const unitPrice = Math.max(0, item.unitPrice);
    const availableQuantity = Number(product.stock_quantity ?? 0);

    if (availableQuantity < quantity) {
      throw new Error(`Insufficient stock for ${product.name}.`);
    }

    const lineTotal = unitPrice * quantity - discountAmount;
    const unitCost = Number(product.cost_price ?? 0);
    const lineProfit = lineTotal - unitCost * quantity;
    const productName =
      String(product.name) + (product.flavor ? ` / ${String(product.flavor)}` : "");

    return {
      saleItemId: crypto.randomUUID(),
      item,
      product,
      productName,
      quantity,
      unitPrice,
      discountAmount,
      unitCost,
      lineTotal,
      lineProfit,
      previousQuantity: availableQuantity,
      newQuantity: availableQuantity - quantity,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalDiscount = normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const totalAmount = Math.max(0, subtotal - totalDiscount);
  const invoiceNumber = generateFastInvoiceNumber();
  const now = new Date().toISOString();
  const paidAt = input.paymentStatus === "paid" ? now : null;
  const saleId = crypto.randomUUID();
  let saleInserted = false;
  const inventoryRollbackStack: Array<{ productId: string; quantityOnHand: number }> = [];

  try {
    const saleInsertPayload: Record<string, unknown> = {
      id: saleId,
      branch_id: session.branchId,
      invoice_number: invoiceNumber,
      employee_id: session.userId,
      status: "completed",
      payment_method: input.paymentMethod,
      payment_status: input.paymentStatus,
      subtotal,
      discount_amount: totalDiscount,
      tax_amount: 0,
      total_amount: totalAmount,
      customer_name: customerName,
      notes,
    };

    if (saleColumnSupport.paidAt) {
      saleInsertPayload.paid_at = paidAt;
    }

    const saleInsert = await admin.from("sales").insert(saleInsertPayload);

    if (saleInsert.error) {
      throw new Error(saleInsert.error.message ?? "Unable to create sale.");
    }

    saleInserted = true;

    const saleItemsPromise = admin.from("sale_items").insert(
      normalizedItems.map((normalizedItem) => {
        const payload: Record<string, unknown> = {
          id: normalizedItem.saleItemId,
          sale_id: saleId,
          product_id: normalizedItem.item.productId,
          product_name_snapshot: normalizedItem.productName,
          sku_snapshot: String(normalizedItem.product.sku ?? ""),
          barcode_snapshot: String(normalizedItem.product.barcode ?? ""),
          quantity: normalizedItem.quantity,
          unit_price: normalizedItem.unitPrice,
          discount_amount: normalizedItem.discountAmount,
          total_line_amount: normalizedItem.lineTotal,
        };

        if (saleColumnSupport.saleItemsExtendedFinancials) {
          payload.pricing_tier = normalizedItem.item.pricingTier;
          payload.unit_cost = normalizedItem.unitCost;
          payload.profit_amount = normalizedItem.lineProfit;
        }

        return payload;
      }),
    );

    const inventoryResults = await Promise.all(
      normalizedItems.map((normalizedItem) =>
        admin
          .from("inventory")
          .update({
            quantity_on_hand: normalizedItem.newQuantity,
            updated_at: now,
          })
          .eq("branch_id", session.branchId)
          .eq("product_id", normalizedItem.item.productId)
          .eq("quantity_on_hand", normalizedItem.previousQuantity)
          .select("product_id")
          .maybeSingle(),
      ),
    );

    for (const [index, inventoryUpdate] of inventoryResults.entries()) {
      const normalizedItem = normalizedItems[index];
      if (inventoryUpdate.error) {
        throw new Error(inventoryUpdate.error.message);
      }

      if (!inventoryUpdate.data) {
        throw new Error(`Stock changed while selling ${normalizedItem.product.name}. Please try again.`);
      }

      inventoryRollbackStack.push({
        productId: normalizedItem.item.productId,
        quantityOnHand: normalizedItem.previousQuantity,
      });
    }

    const saleItemsInsert = await saleItemsPromise;
    if (saleItemsInsert.error) {
      throw new Error(saleItemsInsert.error.message);
    }

    const alertCandidates = normalizedItems
      .filter(
        (normalizedItem) =>
          normalizedItem.newQuantity <= Number(normalizedItem.product.reorder_point ?? 0),
      )
      .map((normalizedItem) => ({
        productId: normalizedItem.item.productId,
        currentQuantity: normalizedItem.newQuantity,
        reorderPoint: Number(normalizedItem.product.reorder_point ?? 0),
      }));

    after(async () => {
      const backgroundAdmin = createAdminSupabaseClient();
      if (!backgroundAdmin) {
        return;
      }

      const postCommitTasks = [
        appendAuditLog(
          session.branchId,
          session.userId,
          saleId,
          input.paymentStatus === "pending" ? "created_pending" : "completed",
          {
            invoice_number: invoiceNumber,
            subtotal,
            discount_amount: totalDiscount,
            payment_status: input.paymentStatus,
            total_amount: totalAmount,
          },
        ),
        backgroundAdmin.from("stock_movements").insert(
          normalizedItems.map((normalizedItem) => ({
            branch_id: session.branchId,
            product_id: normalizedItem.item.productId,
            sale_id: saleId,
            movement_type: "sale",
            quantity_delta: -normalizedItem.quantity,
            previous_quantity: normalizedItem.previousQuantity,
            new_quantity: normalizedItem.newQuantity,
            note:
              input.paymentStatus === "pending"
                ? `Pending sale ${invoiceNumber}`
                : `Sale ${invoiceNumber}`,
            performed_by: session.userId,
          })),
        ),
        ...alertCandidates.map((candidate) =>
          backgroundAdmin.rpc("raise_low_stock_alert", {
            p_branch_id: session.branchId,
            p_product_id: candidate.productId,
            p_current_quantity: candidate.currentQuantity,
            p_reorder_point: candidate.reorderPoint,
          }),
        ),
      ];

      const postCommitResults = await Promise.allSettled(postCommitTasks);
      for (const result of postCommitResults) {
        if (result.status === "rejected") {
          console.error("[createSale] Post-commit task failed", result.reason);
        } else if (
          result.value &&
          typeof result.value === "object" &&
          "error" in result.value &&
          result.value.error
        ) {
          console.error("[createSale] Post-commit task failed", result.value.error);
        }
      }
    });

    return {
      id: saleId,
      branchId: session.branchId,
      invoiceNumber,
      employeeId: session.userId,
      employeeName: session.fullName,
      status: "completed",
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      subtotal,
      discountAmount: totalDiscount,
      taxAmount: 0,
      totalAmount,
      notes,
      customerName,
      createdAt: now,
      paidAt,
      refundedAmount: 0,
      refundedAt: null,
      refundReason: null,
      items: normalizedItems.map((normalizedItem) => ({
        id: normalizedItem.saleItemId,
        productId: normalizedItem.item.productId,
        productName: normalizedItem.productName,
        sku: String(normalizedItem.product.sku ?? ""),
        barcode: String(normalizedItem.product.barcode ?? ""),
        quantity: normalizedItem.quantity,
        unitPrice: normalizedItem.unitPrice,
        pricingTier: normalizedItem.item.pricingTier,
        unitCost: normalizedItem.unitCost,
        discountAmount: normalizedItem.discountAmount,
        lineTotal: normalizedItem.lineTotal,
        lineProfit: normalizedItem.lineProfit,
        refundedQuantity: 0,
        refundedAt: null,
        refundReason: null,
      })),
      refundEvents: [],
    };
  } catch (error) {
    await Promise.all(
      inventoryRollbackStack.map((inventoryRow) =>
        admin
          .from("inventory")
          .update({ quantity_on_hand: inventoryRow.quantityOnHand })
          .eq("branch_id", session.branchId)
          .eq("product_id", inventoryRow.productId),
      ),
    );

    if (saleInserted) {
      await admin.from("sales").delete().eq("id", saleId).eq("branch_id", session.branchId);
    }

    throw error;
  }
}

async function settleLegacyPendingSale(saleId: string, session: AppSession) {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const { data, error } = await admin
    .from("sales")
    .update({
      payment_status: "paid",
    })
    .eq("id", saleId)
    .eq("branch_id", session.branchId)
    .eq("status", "completed")
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Unpaid order was not found or is already settled.");
  }

  await appendAuditLog(session.branchId, session.userId, saleId, "settled_pending", {
    sale_id: saleId,
  });

  return readSaleById(saleId, session.branchId);
}

async function refundLegacyWithCompatibilitySchema(
  saleId: string,
  input: SaleRefundInput,
  session: AppSession,
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
) {
  const refundReason = getTrimmedRefundReason(input.reason);
  const sale = await readSaleById(saleId, session.branchId);
  if (sale.status !== "completed" || !isRefundableStatus(sale.paymentStatus)) {
    throw new Error("Only paid or partially refunded completed orders can be refunded.");
  }

  const refundableItems = sale.items.filter((item) => getRefundableQuantity(item) > 0);
  if (refundableItems.length === 0) {
    throw new Error("This order has no refundable products remaining.");
  }

  const targetItems =
    input.scope === "item"
      ? refundableItems.filter((item) => item.id === input.saleItemId)
      : refundableItems;

  if (targetItems.length === 0) {
    throw new Error("The selected product line is not refundable.");
  }

  const refundQuantities = new Map(
    targetItems.map((item) => [item.id, getRequestedRefundQuantity(item, input)]),
  );

  const productIds = [...new Set(targetItems.map((item) => item.productId))];
  const { data: inventoryRows, error: inventoryError } = await admin
    .from("inventory")
    .select("id, product_id, quantity_on_hand")
    .eq("branch_id", session.branchId)
    .in("product_id", productIds);

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const inventoryByProductId = new Map(
    (inventoryRows ?? []).map((row) => [
      String(row.product_id),
      {
        id: String(row.id),
        quantityOnHand: Number(row.quantity_on_hand ?? 0),
      },
    ]),
  );

  const inventorySnapshot = new Map(
    Array.from(inventoryByProductId.entries()).map(([productId, row]) => [productId, { ...row }]),
  );

  const stockMovements = targetItems.map((item) => {
    const inventoryRow = inventoryByProductId.get(item.productId);
    if (!inventoryRow) {
      throw new Error(`Inventory row is missing for ${item.productName}.`);
    }

    const previousQuantity = inventoryRow.quantityOnHand;
    const quantityToRestore = refundQuantities.get(item.id) ?? 0;
    const newQuantity = previousQuantity + quantityToRestore;
    inventoryRow.quantityOnHand = newQuantity;

    return {
      branch_id: session.branchId,
      product_id: item.productId,
      sale_id: sale.id,
      movement_type: "return",
      quantity_delta: quantityToRestore,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      note: buildRefundMovementNote(sale.invoiceNumber, refundReason),
      performed_by: session.userId,
    };
  });

  const refundedAmountDelta = targetItems.reduce((sum, item) => {
    if (item.quantity <= 0) {
      return sum;
    }

    return sum + (item.lineTotal / item.quantity) * (refundQuantities.get(item.id) ?? 0);
  }, 0);

  const nextItems = sale.items.map((item) => {
    const refundedQuantity = refundQuantities.get(item.id);
    if (!refundedQuantity) {
      return item;
    }

    return {
      ...item,
      refundedQuantity: Math.min(item.quantity, item.refundedQuantity + refundedQuantity),
      refundedAt: new Date().toISOString(),
      refundReason: refundReason ?? null,
    };
  });

  const willBeFullyRefunded = nextItems.every((item) => getRefundableQuantity(item) === 0);

  const restoreInventory = async () => {
    await Promise.all(
      Array.from(inventorySnapshot.values()).map((row) =>
        admin
          .from("inventory")
          .update({ quantity_on_hand: row.quantityOnHand })
          .eq("id", row.id),
      ),
    );
  };

  let movementIds: string[] = [];
  let saleUpdated = false;

  try {
    const inventoryResults = await Promise.all(
      Array.from(inventoryByProductId.values()).map((row) =>
        admin
          .from("inventory")
          .update({ quantity_on_hand: row.quantityOnHand })
          .eq("id", row.id),
      ),
    );
    const failedInventoryUpdate = inventoryResults.find((result) => result.error);
    if (failedInventoryUpdate?.error) {
      throw new Error(failedInventoryUpdate.error.message);
    }

    const movementInsert = await admin.from("stock_movements").insert(stockMovements).select("id");
    if (movementInsert.error) {
      const fallbackInsert = await admin
        .from("stock_movements")
        .insert(
          stockMovements.map((movement) => ({
            ...movement,
            movement_type: "adjustment",
          })),
        )
        .select("id");

      if (fallbackInsert.error) {
        throw new Error(fallbackInsert.error.message);
      }

      movementIds = (fallbackInsert.data ?? []).map((row) => String(row.id));
    } else {
      movementIds = (movementInsert.data ?? []).map((row) => String(row.id));
    }

    const saleUpdatePayload: Record<string, unknown> = {
      notes: buildRefundCompatibilityNotes(sale.notes, sale.invoiceNumber, refundReason),
    };

    if (willBeFullyRefunded) {
      saleUpdatePayload.payment_status = "refunded";
    }

    const saleUpdate = await admin
      .from("sales")
      .update(saleUpdatePayload)
      .eq("id", saleId)
      .eq("branch_id", session.branchId)
      .eq("status", "completed")
      .eq("payment_status", "paid")
      .select("id")
      .maybeSingle();

    if (saleUpdate.error) {
      throw new Error(saleUpdate.error.message);
    }

    if (!saleUpdate.data) {
      throw new Error("Unable to refund this order.");
    }

    saleUpdated = true;

    const auditInsert = await admin.from("audit_logs").insert({
      branch_id: session.branchId,
      actor_id: session.userId,
      entity_type: "sale",
      entity_id: saleId,
      action: "refunded",
      payload: {
        sale_id: saleId,
        invoice_number: sale.invoiceNumber,
        scope: input.scope,
        refunded_item_ids: targetItems.map((item) => item.id),
        refunded_items: targetItems.map((item) => ({
          sale_item_id: item.id,
          quantity: refundQuantities.get(item.id) ?? 0,
        })),
        refund_reason: refundReason ?? null,
        refund_total: refundedAmountDelta,
        compatibility_mode: true,
      },
    });

    if (auditInsert.error) {
      throw new Error(auditInsert.error.message);
    }
  } catch (error) {
    await restoreInventory().catch((rollbackError) => {
      console.error("[refunds] Unable to roll back inventory after failed refund", rollbackError);
    });

    if (saleUpdated) {
      const rollbackSale = await admin
        .from("sales")
        .update({
          payment_status: "paid",
          notes: sale.notes,
        })
        .eq("id", saleId)
        .eq("branch_id", session.branchId);

      if (rollbackSale.error) {
        console.error("[refunds] Unable to roll back sale after failed refund", rollbackSale.error);
      }
    }

    if (movementIds.length > 0) {
      const rollbackDelete = await admin.from("stock_movements").delete().in("id", movementIds);
      if (rollbackDelete.error) {
        console.error(
          "[refunds] Unable to roll back stock movements after failed refund",
          rollbackDelete.error,
        );
      }
    }

    throw error;
  }

  return readSaleById(saleId, session.branchId);
}

async function refundLegacyPaidSale(
  saleId: string,
  input: SaleRefundInput,
  session: AppSession,
) {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const refundSchemaSupport = await getRefundSchemaSupport(admin);
  const hasFullRefundSchemaSupport =
    refundSchemaSupport.salesRefundAmount && refundSchemaSupport.saleItemsRefundState;

  if (!hasFullRefundSchemaSupport) {
    return refundLegacyWithCompatibilitySchema(saleId, input, session, admin);
  }

  const sale = await readSaleById(saleId, session.branchId);
  if (sale.status !== "completed" || !isRefundableStatus(sale.paymentStatus)) {
    throw new Error("Only paid or partially refunded completed orders can be refunded.");
  }

  const refundableItems = sale.items.filter((item) => getRefundableQuantity(item) > 0);
  if (refundableItems.length === 0) {
    throw new Error("This order has no refundable products remaining.");
  }

  const targetItems =
    input.scope === "item"
      ? refundableItems.filter((item) => item.id === input.saleItemId)
      : refundableItems;

  if (targetItems.length === 0) {
    throw new Error("The selected product line is not refundable.");
  }

  const refundQuantities = new Map(
    targetItems.map((item) => [item.id, getRequestedRefundQuantity(item, input)]),
  );

  const productIds = [...new Set(targetItems.map((item) => item.productId))];
  const { data: inventoryRows, error: inventoryError } = await admin
    .from("inventory")
    .select("id, product_id, quantity_on_hand")
    .eq("branch_id", session.branchId)
    .in("product_id", productIds);

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const inventoryByProductId = new Map(
    (inventoryRows ?? []).map((row) => [
      String(row.product_id),
      {
        id: String(row.id),
        quantityOnHand: Number(row.quantity_on_hand ?? 0),
      },
    ]),
  );

  const refundAt = new Date().toISOString();
  const trimmedReason = getTrimmedRefundReason(input.reason);
  const stockMovements = targetItems.map((item) => {
    const inventoryRow = inventoryByProductId.get(item.productId);
    if (!inventoryRow) {
      throw new Error(`Inventory row is missing for ${item.productName}.`);
    }

    const refundableQuantity = refundQuantities.get(item.id) ?? 0;
    const previousQuantity = inventoryRow.quantityOnHand;
    const newQuantity = previousQuantity + refundableQuantity;
    inventoryRow.quantityOnHand = newQuantity;

    return {
      branch_id: session.branchId,
      product_id: item.productId,
      sale_id: sale.id,
      movement_type: "return",
      quantity_delta: refundableQuantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      note: buildRefundMovementNote(sale.invoiceNumber, trimmedReason),
      performed_by: session.userId,
    };
  });

  const refundedAmountDelta = targetItems.reduce((sum, item) => {
    if (item.quantity <= 0) {
      return sum;
    }

    return sum + (item.lineTotal / item.quantity) * (refundQuantities.get(item.id) ?? 0);
  }, 0);

  const inventoryUpdates = Array.from(inventoryByProductId.values()).map((row) =>
    admin
      .from("inventory")
      .update({
        quantity_on_hand: row.quantityOnHand,
      })
      .eq("id", row.id),
  );

  const inventoryResults = await Promise.all(inventoryUpdates);
  const failedInventoryUpdate = inventoryResults.find((result) => result.error);
  if (failedInventoryUpdate?.error) {
    throw new Error(failedInventoryUpdate.error.message);
  }

  const movementInsert = await admin.from("stock_movements").insert(stockMovements);
  if (movementInsert.error) {
    const fallbackInsert = await admin.from("stock_movements").insert(
      stockMovements.map((movement) => ({
        ...movement,
        movement_type: "adjustment",
      })),
    );

    if (fallbackInsert.error) {
      throw new Error(fallbackInsert.error.message);
    }
  }

  const saleItemUpdates = await Promise.all(
    targetItems.map((item) =>
      admin
        .from("sale_items")
        .update({
          refunded_quantity: Math.min(item.quantity, item.refundedQuantity + (refundQuantities.get(item.id) ?? 0)),
          refunded_at: refundAt,
          refund_reason: trimmedReason ?? null,
        })
        .eq("id", item.id)
        .eq("sale_id", sale.id),
    ),
  );
  const failedSaleItemUpdate = saleItemUpdates.find((result) => result.error);
  if (failedSaleItemUpdate?.error) {
    throw new Error(failedSaleItemUpdate.error.message);
  }

  const nextItems = sale.items.map((item) =>
    targetItems.some((candidate) => candidate.id === item.id)
      ? {
          ...item,
          refundedQuantity: Math.min(
            item.quantity,
            item.refundedQuantity + (refundQuantities.get(item.id) ?? 0),
          ),
          refundedAt: refundAt,
          refundReason: trimmedReason ?? null,
        }
      : item,
  );
  const nextStatus: SaleRecord["paymentStatus"] = nextItems.every(
    (item) => getRefundableQuantity(item) === 0,
  )
    ? "refunded"
    : "partially_refunded";
  const refundPayload: Record<string, unknown> = {
    payment_status: nextStatus,
    refunded_amount: Math.min(sale.totalAmount, getSaleRefundedAmount(sale) + refundedAmountDelta),
    refunded_at: refundAt,
    refund_reason: trimmedReason ?? sale.refundReason ?? null,
  };
  const saleUpdate = await admin
    .from("sales")
    .update(refundPayload)
    .eq("id", saleId)
    .eq("branch_id", session.branchId)
    .eq("status", "completed")
    .in("payment_status", ["paid", "partially_refunded"])
    .select("id")
    .maybeSingle();

  if (saleUpdate.error) {
    throw new Error(saleUpdate.error.message);
  }

  if (!saleUpdate.data) {
    throw new Error("Unable to refund this order.");
  }

  await appendAuditLog(session.branchId, session.userId, saleId, "refunded", {
    sale_id: saleId,
    invoice_number: sale.invoiceNumber,
    scope: input.scope,
    refunded_item_ids: targetItems.map((item) => item.id),
    refunded_items: targetItems.map((item) => ({
      sale_item_id: item.id,
      quantity: refundQuantities.get(item.id) ?? 0,
    })),
    refund_reason: trimmedReason ?? null,
    refund_total: refundedAmountDelta,
  });

  return readSaleById(saleId, session.branchId);
}

async function voidLegacyPendingSale(saleId: string, session: AppSession) {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const sale = await readSaleById(saleId, session.branchId);
  if (sale.status !== "completed" || sale.paymentStatus !== "pending") {
    throw new Error("Only unpaid completed orders can be deleted.");
  }

  const productIds = [...new Set(sale.items.map((item) => item.productId))];
  const { data: inventoryRows, error: inventoryError } = await admin
    .from("inventory")
    .select("id, product_id, quantity_on_hand")
    .eq("branch_id", session.branchId)
    .in("product_id", productIds);

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  const inventoryByProductId = new Map(
    (inventoryRows ?? []).map((row) => [
      String(row.product_id),
      {
        id: String(row.id),
        quantityOnHand: Number(row.quantity_on_hand ?? 0),
      },
    ]),
  );

  const stockMovements = sale.items.map((item) => {
    const inventoryRow = inventoryByProductId.get(item.productId);
    if (!inventoryRow) {
      throw new Error(`Inventory row is missing for ${item.productName}.`);
    }

    const previousQuantity = inventoryRow.quantityOnHand;
    const newQuantity = previousQuantity + item.quantity;
    inventoryRow.quantityOnHand = newQuantity;

    return {
      branch_id: session.branchId,
      product_id: item.productId,
      sale_id: sale.id,
      movement_type: "void",
      quantity_delta: item.quantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      note: `Voided unpaid order ${sale.invoiceNumber}`,
      performed_by: session.userId,
    };
  });

  const inventoryUpdates = Array.from(inventoryByProductId.values()).map((row) =>
    admin
      .from("inventory")
      .update({
        quantity_on_hand: row.quantityOnHand,
      })
      .eq("id", row.id),
  );

  const inventoryResults = await Promise.all(inventoryUpdates);
  const failedInventoryUpdate = inventoryResults.find((result) => result.error);
  if (failedInventoryUpdate?.error) {
    throw new Error(failedInventoryUpdate.error.message);
  }

  const movementInsert = await admin.from("stock_movements").insert(stockMovements);
  if (movementInsert.error) {
    const fallbackInsert = await admin.from("stock_movements").insert(
      stockMovements.map((movement) => ({
        ...movement,
        movement_type: "adjustment",
      })),
    );

    if (fallbackInsert.error) {
      throw new Error(fallbackInsert.error.message);
    }
  }

  const { data: updatedSale, error: saleUpdateError } = await admin
    .from("sales")
    .update({
      status: "cancelled",
      payment_status: "void",
    })
    .eq("id", saleId)
    .eq("branch_id", session.branchId)
    .eq("status", "completed")
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (saleUpdateError) {
    throw new Error(saleUpdateError.message);
  }

  if (!updatedSale) {
    throw new Error("Unable to delete this unpaid order.");
  }

  await appendAuditLog(session.branchId, session.userId, saleId, "void_pending", {
    sale_id: saleId,
    invoice_number: sale.invoiceNumber,
  });

  return {
    ...sale,
    status: "cancelled" as const,
    paymentStatus: "void" as const,
    paidAt: null,
  };
}

async function getSupabaseSnapshot(session: AppSession): Promise<DashboardSnapshot> {
  assertSupabaseConfigured();
  const supabase = await createServerSupabaseClient();

  const [
    productsResult,
    salesResult,
    employeesResult,
    suppliersResult,
    alertsResult,
    movementsResult,
    expensesResult,
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
      .order("created_at", { ascending: false }),
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
    supabase!
      .from("operating_expenses")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("incurred_on", { ascending: false }),
    supabase!.from("categories").select("id, name, slug").order("name"),
    supabase!.from("brands").select("id, name").order("name"),
    supabase!
      .from("sales_daily_view")
      .select("*")
      .eq("branch_id", session.branchId)
      .order("day", { ascending: true })
      .gte("day", startOfDay(addDays(new Date(), -6)).toISOString()),
  ]);

  const requiredErrors = [
    productsResult.error,
    salesResult.error,
    employeesResult.error,
    suppliersResult.error,
    alertsResult.error,
    movementsResult.error,
    expensesResult.error &&
    !isMissingRelationError(expensesResult.error.message, "operating_expenses")
      ? expensesResult.error
      : null,
    categoriesResult.error,
    brandsResult.error,
    trendResult.error && !isMissingRelationError(trendResult.error.message, "sales_daily_view")
      ? trendResult.error
      : null,
  ].find((error) => error);

  if (requiredErrors) {
    throw new Error(requiredErrors.message);
  }

  const products = (productsResult.data ?? []).map((row) => mapProduct(row));
  const sales = (await enrichSalesWithCompatibilityRefunds(
    (salesResult.data ?? []).map((row) => mapSale(row)),
    session.branchId,
    supabase!,
  )).sort((left, right) => getSaleSortDate(right).localeCompare(getSaleSortDate(left)));
  const employees = (employeesResult.data ?? []).map((row) => mapEmployee(row));
  const suppliers = (suppliersResult.data ?? []).map((row) => mapSupplier(row));
  const alerts = (alertsResult.data ?? []).map((row) => mapAlert(row));
  const stockMovements = (movementsResult.data ?? []).map((row) => mapStockMovement(row));
  const expenses =
    expensesResult.error && isMissingRelationError(expensesResult.error.message, "operating_expenses")
      ? []
      : (expensesResult.data ?? []).map((row) => mapExpense(row));
  const categories = (categoriesResult.data ?? []) as CategoryRecord[];
  const brands = (brandsResult.data ?? []) as BrandRecord[];
  const salesTrend =
    trendResult.data?.map((row) => ({
      label: new Date(String(row.day)).toLocaleDateString("en-US", {
        weekday: "short",
      }),
      revenue: Number(row.revenue ?? 0),
      transactions: Number(row.transactions ?? 0),
    })) ?? [];

  const summary = buildDashboardSummary({
    products,
    sales,
    expenses,
  });

  return {
    session,
    summary,
    salesTrend,
    products,
    sales,
    employees,
    suppliers,
    expenses,
    alerts,
    stockMovements,
    categories,
    brands,
  };
}

export async function getDashboardSnapshot(session: AppSession) {
  assertSupabaseConfigured();
  return getSupabaseSnapshot(session);
}

export async function createSale(input: PosSaleInput, session: AppSession) {
  assertSupabaseConfigured();
  return createDirectSupabaseSale(input, session);
}

export async function settlePendingSale(saleId: string, session: AppSession) {
  assertSupabaseConfigured();
  return settleLegacyPendingSale(saleId, session);
}

export async function voidPendingSale(saleId: string, session: AppSession) {
  assertSupabaseConfigured();
  return voidLegacyPendingSale(saleId, session);
}

export async function refundPaidSale(
  saleId: string,
  input: SaleRefundInput,
  session: AppSession,
) {
  assertSupabaseConfigured();
  return refundLegacyPaidSale(saleId, input, session);
}

export async function mutateProduct(input: ProductMutationInput, session: AppSession) {
  assertSupabaseConfigured();
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

  const productColumnSupport = await getProductColumnSupport(admin);

  const basePayload = {
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

  const payload: Record<string, unknown> = { ...basePayload };
  if (productColumnSupport.wholesalePrice) {
    payload.wholesale_price = input.wholesalePrice;
  }
  if (productColumnSupport.discountPrice) {
    payload.discount_price = input.discountPrice ?? null;
  }

  const legacyPayload = { ...basePayload };

  let productResult = input.id
    ? await admin.from("products").update(payload).eq("id", input.id).select("*").single()
    : await admin.from("products").insert(payload).select("*").single();

  if (
    productResult.error &&
    (isMissingColumnError(productResult.error.message, "discount_price") ||
      isMissingColumnError(productResult.error.message, "wholesale_price"))
  ) {
    productResult = input.id
      ? await admin.from("products").update(legacyPayload).eq("id", input.id).select("*").single()
      : await admin.from("products").insert(legacyPayload).select("*").single();
  }

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

export async function deleteProduct(productId: string, session: AppSession) {
  assertSupabaseConfigured();
  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const saleHistoryResult = await admin
    .from("sale_items")
    .select("id")
    .eq("product_id", productId)
    .limit(1);

  if (saleHistoryResult.error) {
    throw new Error(saleHistoryResult.error.message);
  }

  if ((saleHistoryResult.data ?? []).length > 0) {
    throw new Error(
      "This product has sales history and cannot be deleted. Delete only products that were never sold.",
    );
  }

  const { data, error } = await admin
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("branch_id", session.branchId)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to delete product.");
  }

  return { productId: String(data.id) };
}

export async function adjustInventory(input: InventoryAdjustmentInput, session: AppSession) {
  assertSupabaseConfigured();
  if (session.role !== "admin") {
    throw new Error("Only admins can adjust inventory.");
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    throw new Error("Supabase admin client is not configured.");
  }

  const normalizedNote = input.note.trim();
  const [{ data: inventoryRow, error: inventoryError }, { data: productRow, error: productError }] =
    await Promise.all([
      admin
        .from("inventory")
        .select("id, quantity_on_hand, reorder_point, last_restocked_at")
        .eq("branch_id", session.branchId)
        .eq("product_id", input.productId)
        .maybeSingle(),
      admin
        .from("products")
        .select("id, name, flavor")
        .eq("branch_id", session.branchId)
        .eq("id", input.productId)
        .maybeSingle(),
    ]);

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  if (productError) {
    throw new Error(productError.message);
  }

  if (!inventoryRow || !productRow) {
    throw new Error("Inventory row not found.");
  }

  const previousQuantity = Number(inventoryRow.quantity_on_hand ?? 0);
  const reorderPoint = Number(inventoryRow.reorder_point ?? 0);
  const newQuantity = previousQuantity + input.quantityDelta;

  if (newQuantity < 0) {
    throw new Error("Adjustment would result in negative stock.");
  }

  const movementType: StockMovementRecord["movementType"] =
    input.quantityDelta >= 0 ? "restock" : "adjustment";
  const now = new Date().toISOString();
  const movementId = crypto.randomUUID();
  const previousLastRestockedAt = (inventoryRow.last_restocked_at as string | null) ?? null;

  const inventoryUpdatePayload: Record<string, unknown> = {
    quantity_on_hand: newQuantity,
    updated_at: now,
  };

  if (input.quantityDelta > 0) {
    inventoryUpdatePayload.last_restocked_at = now;
  }

  const inventoryUpdate = await admin
    .from("inventory")
    .update(inventoryUpdatePayload)
    .eq("id", inventoryRow.id)
    .eq("branch_id", session.branchId)
    .eq("product_id", input.productId)
    .select("id")
    .maybeSingle();

  if (inventoryUpdate.error || !inventoryUpdate.data) {
    throw new Error(inventoryUpdate.error?.message ?? "Unable to update inventory.");
  }

  const movementInsert = await admin.from("stock_movements").insert({
    id: movementId,
    branch_id: session.branchId,
    product_id: input.productId,
    supplier_id: input.supplierId ?? null,
    movement_type: movementType,
    quantity_delta: input.quantityDelta,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    note: normalizedNote,
    performed_by: session.userId,
  });

  if (movementInsert.error) {
    await admin
      .from("inventory")
      .update({
        quantity_on_hand: previousQuantity,
        last_restocked_at: previousLastRestockedAt,
        updated_at: now,
      })
      .eq("id", inventoryRow.id)
      .eq("branch_id", session.branchId)
      .eq("product_id", input.productId);

    throw new Error(movementInsert.error.message);
  }

  const lowStockAlert = await admin.rpc("raise_low_stock_alert", {
    p_branch_id: session.branchId,
    p_product_id: input.productId,
    p_current_quantity: newQuantity,
    p_reorder_point: reorderPoint,
  });

  if (lowStockAlert.error) {
    console.error("[adjustInventory] Unable to raise low stock alert", lowStockAlert.error);
  }

  await appendAuditLog(
    session.branchId,
    session.userId,
    input.productId,
    "adjusted",
    {
      quantity_delta: input.quantityDelta,
      new_quantity: newQuantity,
      note: normalizedNote,
      supplier_id: input.supplierId ?? null,
    },
    "inventory",
  );

  const movementResult = await admin
    .from("stock_movements_view")
    .select("*")
    .eq("id", movementId)
    .maybeSingle();

  if (movementResult.error) {
    throw new Error(movementResult.error.message);
  }

  if (movementResult.data) {
    return mapStockMovement(movementResult.data as Record<string, unknown>);
  }

  return {
    id: movementId,
    productId: input.productId,
    productName:
      String(productRow.name) +
      ((productRow.flavor as string | null) ? ` / ${String(productRow.flavor)}` : ""),
    movementType,
    quantityDelta: input.quantityDelta,
    previousQuantity,
    newQuantity,
    note: normalizedNote,
    performedBy: session.userId,
    performedByName: session.fullName,
    supplierId: input.supplierId ?? null,
    createdAt: now,
  };
}

export async function getPosProducts(session: AppSession) {
  const snapshot = await getDashboardSnapshot(session);
  return snapshot.products.filter((product) => product.isActive);
}

export function getDemoDataset() {
  throw new Error(
    "Demo dataset access has been removed. Configure Supabase and use the live data pipeline instead.",
  );
}
