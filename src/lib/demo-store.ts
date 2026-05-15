import { addDays, startOfMonth, subDays } from "date-fns";
import { nanoid } from "nanoid";
import {
  type AlertRecord,
  type AppSession,
  type BrandRecord,
  type CategoryRecord,
  type DailySalesPoint,
  type DashboardSnapshot,
  type EmployeeRecord,
  type ExpenseRecord,
  type InventoryAdjustmentInput,
  type PosSaleInput,
  type ProductMutationInput,
  type ProductRecord,
  type ProductPricingTier,
  type SaleItemRecord,
  type SaleRecord,
  type StockMovementRecord,
  type SupplierRecord,
} from "@/lib/types";
import { createInvoiceNumber, slugify } from "@/lib/utils";
import { buildDashboardSummary } from "@/lib/reporting";

interface DemoStore {
  sessions: Record<string, AppSession>;
  categories: CategoryRecord[];
  brands: BrandRecord[];
  suppliers: SupplierRecord[];
  expenses: ExpenseRecord[];
  employees: EmployeeRecord[];
  products: ProductRecord[];
  stockMovements: StockMovementRecord[];
  sales: SaleRecord[];
  alerts: AlertRecord[];
}

declare global {
  var __proteinDemoStore: DemoStore | undefined;
}

const branchId = "branch-main";
const branchName = "Saida Main Branch";

function nowIso() {
  return new Date().toISOString();
}

function normalizeBrandName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function resolveTierPrice(product: ProductRecord, pricingTier: ProductPricingTier) {
  if (pricingTier === "wholesale") {
    return product.wholesalePrice;
  }

  if (pricingTier === "discount" && product.discountPrice != null) {
    return product.discountPrice;
  }

  return product.salePrice;
}

function createStore(): DemoStore {
  const categories: CategoryRecord[] = [
    { id: "cat-whey", name: "Whey Protein", slug: "whey-protein" },
    { id: "cat-pre", name: "Pre-Workout", slug: "pre-workout" },
    { id: "cat-vitamins", name: "Vitamins", slug: "vitamins" },
    { id: "cat-bars", name: "Protein Bars", slug: "protein-bars" },
    { id: "cat-creatine", name: "Creatine", slug: "creatine" },
    { id: "cat-fat-burner", name: "Fat Burner", slug: "fat-burner" },
    { id: "cat-carbs", name: "Carbs", slug: "carbs" },
  ];

  const brands: BrandRecord[] = [
    { id: "brand-optimum", name: "Optimum Fuel" },
    { id: "brand-raw", name: "Raw Lab" },
    { id: "brand-prime", name: "Prime Strength" },
    { id: "brand-core", name: "Core Active" },
  ];

  const suppliers: SupplierRecord[] = [
    {
      id: "sup-fitline",
      name: "Fitline Distributors",
      contactName: "Maya Kassis",
      phone: "+961 70 101 111",
      email: "maya@fitline.co",
      notes: "Fastest whey turnaround and monthly volume discount.",
      restockCount: 18,
      activeProducts: 5,
    },
    {
      id: "sup-peak",
      name: "Peak Imports",
      contactName: "Rami Hallak",
      phone: "+961 71 202 222",
      email: "rami@peakimports.co",
      notes: "Handles pre-workout and accessories.",
      restockCount: 12,
      activeProducts: 3,
    },
  ];

  const employees: EmployeeRecord[] = [
    {
      id: "user-admin",
      fullName: "Rita Manager",
      email: "admin@protein.local",
      role: "admin",
      branchId,
      branchName,
      phone: "+961 70 777 000",
      status: "active",
      lastLoginAt: subDays(new Date(), 1).toISOString(),
      totalSales: 0,
      totalRevenue: 0,
      transactionCount: 0,
    },
    {
      id: "user-employee",
      fullName: "Omar Cashier",
      email: "employee@protein.local",
      role: "employee",
      branchId,
      branchName,
      phone: "+961 71 555 111",
      status: "active",
      lastLoginAt: subDays(new Date(), 0).toISOString(),
      totalSales: 42,
      totalRevenue: 4820,
      transactionCount: 39,
    },
  ];

  const products: ProductRecord[] = [
    {
      id: "prod-gold-whey",
      branchId,
      name: "Gold Whey Isolate",
      description: "Fast-mixing isolate protein with smooth texture and low sugar.",
      categoryId: "cat-whey",
      categoryName: "Whey Protein",
      brandId: "brand-optimum",
      brandName: "Optimum Fuel",
      supplierId: "sup-fitline",
      supplierName: "Fitline Distributors",
      flavor: "Double Chocolate",
      sizeLabel: "5 lb",
      sku: "WHEY-ISO-5LB-CHO",
      barcode: "6281001000101",
      salePrice: 79,
      wholesalePrice: 68,
      discountPrice: 72,
      costPrice: 54,
      stockQuantity: 18,
      reorderPoint: 8,
      expiryDate: addDays(new Date(), 220).toISOString(),
      imageUrl:
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80",
      isActive: true,
      archivedAt: null,
      updatedAt: nowIso(),
      lastRestockedAt: subDays(new Date(), 5).toISOString(),
    },
    {
      id: "prod-gold-whey-vanilla",
      branchId,
      name: "Gold Whey Isolate",
      description: "Vanilla isolate protein made for lean recovery and easy digestion.",
      categoryId: "cat-whey",
      categoryName: "Whey Protein",
      brandId: "brand-optimum",
      brandName: "Optimum Fuel",
      supplierId: "sup-fitline",
      supplierName: "Fitline Distributors",
      flavor: "Vanilla Cream",
      sizeLabel: "2 lb",
      sku: "WHEY-ISO-2LB-VAN",
      barcode: "6281001000102",
      salePrice: 42,
      wholesalePrice: 36,
      discountPrice: 39,
      costPrice: 28,
      stockQuantity: 11,
      reorderPoint: 6,
      expiryDate: addDays(new Date(), 120).toISOString(),
      imageUrl:
        "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=600&q=80",
      isActive: true,
      archivedAt: null,
      updatedAt: nowIso(),
      lastRestockedAt: subDays(new Date(), 8).toISOString(),
    },
    {
      id: "prod-raw-pre",
      branchId,
      name: "Nitro Surge Pre-Workout",
      description: "High-focus pre-workout with beta alanine and citrulline blend.",
      categoryId: "cat-pre",
      categoryName: "Pre-Workout",
      brandId: "brand-raw",
      brandName: "Raw Lab",
      supplierId: "sup-peak",
      supplierName: "Peak Imports",
      flavor: "Blue Ice",
      sizeLabel: "30 servings",
      sku: "PRE-RAW-30-BLU",
      barcode: "6281001000201",
      salePrice: 36,
      wholesalePrice: 29,
      discountPrice: 32,
      costPrice: 21,
      stockQuantity: 7,
      reorderPoint: 8,
      expiryDate: addDays(new Date(), 85).toISOString(),
      imageUrl:
        "https://images.unsplash.com/photo-1604480133435-25b86862d276?auto=format&fit=crop&w=600&q=80",
      isActive: true,
      archivedAt: null,
      updatedAt: nowIso(),
      lastRestockedAt: subDays(new Date(), 11).toISOString(),
    },
    {
      id: "prod-vita-core",
      branchId,
      name: "Performance Multivitamin",
      description: "Daily micronutrient formula designed for athletes and busy schedules.",
      categoryId: "cat-vitamins",
      categoryName: "Vitamins",
      brandId: "brand-core",
      brandName: "Core Active",
      supplierId: "sup-fitline",
      supplierName: "Fitline Distributors",
      flavor: "Unflavored",
      sizeLabel: "90 capsules",
      sku: "VITA-CORE-90",
      barcode: "6281001000301",
      salePrice: 24,
      wholesalePrice: 20,
      discountPrice: 21,
      costPrice: 12,
      stockQuantity: 27,
      reorderPoint: 10,
      expiryDate: addDays(new Date(), 45).toISOString(),
      imageUrl:
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80",
      isActive: true,
      archivedAt: null,
      updatedAt: nowIso(),
      lastRestockedAt: subDays(new Date(), 4).toISOString(),
    },
    {
      id: "prod-bar-prime",
      branchId,
      name: "Prime Crunch Protein Bar",
      description: "On-the-go bar with crisp texture and 20g protein.",
      categoryId: "cat-bars",
      categoryName: "Protein Bars",
      brandId: "brand-prime",
      brandName: "Prime Strength",
      supplierId: "sup-peak",
      supplierName: "Peak Imports",
      flavor: "Caramel Peanut",
      sizeLabel: "Box of 12",
      sku: "BAR-PRIME-12-CP",
      barcode: "6281001000401",
      salePrice: 28,
      wholesalePrice: 22,
      discountPrice: 24,
      costPrice: 17,
      stockQuantity: 4,
      reorderPoint: 6,
      expiryDate: addDays(new Date(), 21).toISOString(),
      imageUrl:
        "https://images.unsplash.com/photo-1622484212850-06c0b6cb6f96?auto=format&fit=crop&w=600&q=80",
      isActive: true,
      archivedAt: null,
      updatedAt: nowIso(),
      lastRestockedAt: subDays(new Date(), 15).toISOString(),
    },
  ];

  const sales: SaleRecord[] = [
    {
      id: "sale-001",
      branchId,
      invoiceNumber: createInvoiceNumber(1),
      employeeId: "user-employee",
      employeeName: "Omar Cashier",
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "paid",
      subtotal: 121,
      discountAmount: 6,
      taxAmount: 0,
      totalAmount: 115,
      notes: "Bundle offer at checkout.",
      customerName: "Walk-in customer",
      createdAt: subDays(new Date(), 1).toISOString(),
      items: [
        {
          id: "line-001",
          productId: "prod-gold-whey",
          productName: "Gold Whey Isolate",
          sku: "WHEY-ISO-5LB-CHO",
          barcode: "6281001000101",
          quantity: 1,
          unitPrice: 79,
          pricingTier: "retail",
          unitCost: 54,
          discountAmount: 4,
          lineTotal: 75,
          lineProfit: 21,
        },
        {
          id: "line-002",
          productId: "prod-raw-pre",
          productName: "Nitro Surge Pre-Workout",
          sku: "PRE-RAW-30-BLU",
          barcode: "6281001000201",
          quantity: 1,
          unitPrice: 36,
          pricingTier: "retail",
          unitCost: 21,
          discountAmount: 2,
          lineTotal: 34,
          lineProfit: 13,
        },
        {
          id: "line-003",
          productId: "prod-vita-core",
          productName: "Performance Multivitamin",
          sku: "VITA-CORE-90",
          barcode: "6281001000301",
          quantity: 1,
          unitPrice: 24,
          pricingTier: "retail",
          unitCost: 12,
          discountAmount: 0,
          lineTotal: 24,
          lineProfit: 12,
        },
      ],
    },
    {
      id: "sale-002",
      branchId,
      invoiceNumber: createInvoiceNumber(2),
      employeeId: "user-employee",
      employeeName: "Omar Cashier",
      status: "completed",
      paymentMethod: "card",
      paymentStatus: "paid",
      subtotal: 84,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 84,
      notes: "",
      customerName: null,
      createdAt: subDays(new Date(), 0).toISOString(),
      items: [
        {
          id: "line-004",
          productId: "prod-gold-whey-vanilla",
          productName: "Gold Whey Isolate",
          sku: "WHEY-ISO-2LB-VAN",
          barcode: "6281001000102",
          quantity: 2,
          unitPrice: 42,
          pricingTier: "retail",
          unitCost: 28,
          discountAmount: 0,
          lineTotal: 84,
          lineProfit: 28,
        },
      ],
    },
    {
      id: "sale-003",
      branchId,
      invoiceNumber: createInvoiceNumber(3),
      employeeId: "user-admin",
      employeeName: "Rita Manager",
      status: "completed",
      paymentMethod: "bank_transfer",
      paymentStatus: "paid",
      subtotal: 244,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 244,
      notes: "Gym wholesale replenishment.",
      customerName: "Titan Gym",
      createdAt: subDays(new Date(), 18).toISOString(),
      items: [
        {
          id: "line-005",
          productId: "prod-gold-whey",
          productName: "Gold Whey Isolate",
          sku: "WHEY-ISO-5LB-CHO",
          barcode: "6281001000101",
          quantity: 3,
          unitPrice: 68,
          pricingTier: "wholesale",
          unitCost: 54,
          discountAmount: 0,
          lineTotal: 204,
          lineProfit: 42,
        },
        {
          id: "line-006",
          productId: "prod-vita-core",
          productName: "Performance Multivitamin",
          sku: "VITA-CORE-90",
          barcode: "6281001000301",
          quantity: 2,
          unitPrice: 20,
          pricingTier: "wholesale",
          unitCost: 12,
          discountAmount: 0,
          lineTotal: 40,
          lineProfit: 16,
        },
      ],
    },
    {
      id: "sale-004",
      branchId,
      invoiceNumber: createInvoiceNumber(4),
      employeeId: "user-employee",
      employeeName: "Omar Cashier",
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "paid",
      subtotal: 88,
      discountAmount: 4,
      taxAmount: 0,
      totalAmount: 84,
      notes: "Weekend in-store promo.",
      customerName: "Lina A.",
      createdAt: subDays(new Date(), 35).toISOString(),
      items: [
        {
          id: "line-007",
          productId: "prod-bar-prime",
          productName: "Prime Crunch Protein Bar",
          sku: "BAR-PRIME-12-CP",
          barcode: "6281001000401",
          quantity: 2,
          unitPrice: 24,
          pricingTier: "discount",
          unitCost: 17,
          discountAmount: 0,
          lineTotal: 48,
          lineProfit: 14,
        },
        {
          id: "line-008",
          productId: "prod-raw-pre",
          productName: "Nitro Surge Pre-Workout",
          sku: "PRE-RAW-30-BLU",
          barcode: "6281001000201",
          quantity: 1,
          unitPrice: 32,
          pricingTier: "discount",
          unitCost: 21,
          discountAmount: 0,
          lineTotal: 32,
          lineProfit: 11,
        },
        {
          id: "line-009",
          productId: "prod-vita-core",
          productName: "Performance Multivitamin",
          sku: "VITA-CORE-90",
          barcode: "6281001000301",
          quantity: 1,
          unitPrice: 24,
          pricingTier: "retail",
          unitCost: 12,
          discountAmount: 0,
          lineTotal: 24,
          lineProfit: 12,
        },
      ],
    },
    {
      id: "sale-005",
      branchId,
      invoiceNumber: createInvoiceNumber(5),
      employeeId: "user-employee",
      employeeName: "Omar Cashier",
      status: "completed",
      paymentMethod: "card",
      paymentStatus: "paid",
      subtotal: 126,
      discountAmount: 6,
      taxAmount: 0,
      totalAmount: 120,
      notes: "Bundle for recurring customer.",
      customerName: "Mazen K.",
      createdAt: subDays(new Date(), 52).toISOString(),
      items: [
        {
          id: "line-010",
          productId: "prod-gold-whey-vanilla",
          productName: "Gold Whey Isolate",
          sku: "WHEY-ISO-2LB-VAN",
          barcode: "6281001000102",
          quantity: 3,
          unitPrice: 42,
          pricingTier: "retail",
          unitCost: 28,
          discountAmount: 6,
          lineTotal: 120,
          lineProfit: 36,
        },
      ],
    },
    {
      id: "sale-006",
      branchId,
      invoiceNumber: createInvoiceNumber(6),
      employeeId: "user-admin",
      employeeName: "Rita Manager",
      status: "completed",
      paymentMethod: "bank_transfer",
      paymentStatus: "paid",
      subtotal: 166,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 166,
      notes: "Wholesale vitamins and bars order.",
      customerName: "Powerhouse Fitness",
      createdAt: subDays(new Date(), 83).toISOString(),
      items: [
        {
          id: "line-011",
          productId: "prod-vita-core",
          productName: "Performance Multivitamin",
          sku: "VITA-CORE-90",
          barcode: "6281001000301",
          quantity: 5,
          unitPrice: 20,
          pricingTier: "wholesale",
          unitCost: 12,
          discountAmount: 0,
          lineTotal: 100,
          lineProfit: 40,
        },
        {
          id: "line-012",
          productId: "prod-bar-prime",
          productName: "Prime Crunch Protein Bar",
          sku: "BAR-PRIME-12-CP",
          barcode: "6281001000401",
          quantity: 3,
          unitPrice: 22,
          pricingTier: "wholesale",
          unitCost: 17,
          discountAmount: 0,
          lineTotal: 66,
          lineProfit: 15,
        },
      ],
    },
    {
      id: "sale-007",
      branchId,
      invoiceNumber: createInvoiceNumber(7),
      employeeId: "user-employee",
      employeeName: "Omar Cashier",
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "paid",
      subtotal: 111,
      discountAmount: 3,
      taxAmount: 0,
      totalAmount: 108,
      notes: "Back-to-gym promotion.",
      customerName: "Sara N.",
      createdAt: subDays(new Date(), 110).toISOString(),
      items: [
        {
          id: "line-013",
          productId: "prod-gold-whey",
          productName: "Gold Whey Isolate",
          sku: "WHEY-ISO-5LB-CHO",
          barcode: "6281001000101",
          quantity: 1,
          unitPrice: 72,
          pricingTier: "discount",
          unitCost: 54,
          discountAmount: 0,
          lineTotal: 72,
          lineProfit: 18,
        },
        {
          id: "line-014",
          productId: "prod-raw-pre",
          productName: "Nitro Surge Pre-Workout",
          sku: "PRE-RAW-30-BLU",
          barcode: "6281001000201",
          quantity: 1,
          unitPrice: 36,
          pricingTier: "retail",
          unitCost: 21,
          discountAmount: 3,
          lineTotal: 33,
          lineProfit: 12,
        },
      ],
    },
  ];

  const expenses: ExpenseRecord[] = [
    {
      id: "exp-001",
      branchId,
      category: "rent",
      label: "Shop rent",
      amount: 1800,
      notes: "Main branch monthly rent",
      incurredOn: startOfMonth(new Date()).toISOString(),
      recurring: true,
      createdAt: nowIso(),
    },
    {
      id: "exp-002",
      branchId,
      category: "salary",
      label: "Staff salaries",
      amount: 1250,
      notes: "Monthly payroll allocation",
      incurredOn: startOfMonth(new Date()).toISOString(),
      recurring: true,
      createdAt: nowIso(),
    },
    {
      id: "exp-003",
      branchId,
      category: "electricity",
      label: "Electricity and internet",
      amount: 220,
      notes: "Utilities for the current month",
      incurredOn: subDays(new Date(), 5).toISOString(),
      recurring: true,
      createdAt: nowIso(),
    },
    {
      id: "exp-004",
      branchId,
      category: "imports",
      label: "Import forwarding",
      amount: 640,
      notes: "Protein shipment clearance",
      incurredOn: subDays(new Date(), 26).toISOString(),
      recurring: false,
      createdAt: nowIso(),
    },
    {
      id: "exp-005",
      branchId,
      category: "delivery",
      label: "Courier and local delivery",
      amount: 145,
      notes: "Same-day store delivery support",
      incurredOn: subDays(new Date(), 11).toISOString(),
      recurring: false,
      createdAt: nowIso(),
    },
    {
      id: "exp-006",
      branchId,
      category: "customs",
      label: "Customs fees",
      amount: 520,
      notes: "Recent import customs payment",
      incurredOn: subDays(new Date(), 63).toISOString(),
      recurring: false,
      createdAt: nowIso(),
    },
  ];

  const stockMovements: StockMovementRecord[] = [
    {
      id: "move-001",
      productId: "prod-raw-pre",
      productName: "Nitro Surge Pre-Workout",
      movementType: "restock",
      quantityDelta: 12,
      previousQuantity: 0,
      newQuantity: 12,
      note: "Supplier delivery received",
      performedBy: "user-admin",
      performedByName: "Rita Manager",
      supplierId: "sup-peak",
      createdAt: subDays(new Date(), 11).toISOString(),
    },
    {
      id: "move-002",
      productId: "prod-gold-whey",
      productName: "Gold Whey Isolate",
      movementType: "sale",
      quantityDelta: -1,
      previousQuantity: 19,
      newQuantity: 18,
      note: "Checkout sale",
      performedBy: "user-employee",
      performedByName: "Omar Cashier",
      createdAt: subDays(new Date(), 1).toISOString(),
    },
    {
      id: "move-003",
      productId: "prod-bar-prime",
      productName: "Prime Crunch Protein Bar",
      movementType: "adjustment",
      quantityDelta: -2,
      previousQuantity: 6,
      newQuantity: 4,
      note: "Damaged box removed from shelf",
      performedBy: "user-admin",
      performedByName: "Rita Manager",
      createdAt: subDays(new Date(), 2).toISOString(),
    },
  ];

  const alerts: AlertRecord[] = [
    {
      id: "alert-001",
      severity: "critical",
      title: "Immediate replenishment needed",
      message: "Prime Crunch Protein Bar is below the minimum shelf quantity.",
      productId: "prod-bar-prime",
      productName: "Prime Crunch Protein Bar",
      createdAt: subDays(new Date(), 0).toISOString(),
    },
    {
      id: "alert-002",
      severity: "warning",
      title: "Expiry approaching",
      message: "Performance Multivitamin expires within the next 45 days.",
      productId: "prod-vita-core",
      productName: "Performance Multivitamin",
      createdAt: subDays(new Date(), 0).toISOString(),
    },
  ];

  return {
    sessions: {
      admin: {
        userId: "user-admin",
        email: "admin@protein.local",
        fullName: "Rita Manager",
        role: "admin",
        branchId,
        branchName,
        mode: "demo",
      },
      employee: {
        userId: "user-employee",
        email: "employee@protein.local",
        fullName: "Omar Cashier",
        role: "employee",
        branchId,
        branchName,
        mode: "demo",
      },
    },
    categories,
    brands,
    suppliers,
    expenses,
    employees,
    products,
    stockMovements,
    sales,
    alerts,
  };
}

export function getDemoStore() {
  if (!global.__proteinDemoStore) {
    global.__proteinDemoStore = createStore();
  }

  return global.__proteinDemoStore;
}

export function getDemoSession(role: "admin" | "employee") {
  return getDemoStore().sessions[role];
}

export function getDailySalesPoints(): DailySalesPoint[] {
  const store = getDemoStore();
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const targetDate = subDays(today, 6 - index);
    const dayKey = targetDate.toISOString().slice(0, 10);
    const daySales = store.sales.filter(
      (sale) => sale.status === "completed" && sale.createdAt.slice(0, 10) === dayKey,
    );

    return {
      label: targetDate.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: daySales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      transactions: daySales.length,
    };
  });
}

export function getDemoSnapshot(session: AppSession): DashboardSnapshot {
  const store = getDemoStore();
  const summary = buildDashboardSummary({
    products: store.products,
    sales: store.sales,
    expenses: store.expenses,
  });

  return {
    session,
    summary,
    salesTrend: getDailySalesPoints(),
    products: [...store.products],
    sales: [...store.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    employees: [...store.employees],
    suppliers: [...store.suppliers],
    expenses: [...store.expenses],
    alerts: [...store.alerts],
    stockMovements: [...store.stockMovements].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    categories: [...store.categories],
    brands: [...store.brands],
  };
}

export function upsertDemoProduct(input: ProductMutationInput) {
  const store = getDemoStore();
  const category = store.categories.find((item) => item.id === input.categoryId);
  const normalizedBrandName = normalizeBrandName(input.brandName);
  let brand =
    (input.brandId ? store.brands.find((item) => item.id === input.brandId) : null) ??
    store.brands.find(
      (item) => normalizeBrandName(item.name).toLowerCase() === normalizedBrandName.toLowerCase(),
    );
  const supplier = input.supplierId
    ? store.suppliers.find((item) => item.id === input.supplierId)
    : null;

  if (!category || !normalizedBrandName) {
    throw new Error("Related product data is missing.");
  }

  if (input.supplierId && !supplier) {
    throw new Error("Selected supplier was not found.");
  }

  if (!brand) {
    brand = {
      id: `brand-${slugify(normalizedBrandName)}-${nanoid(4)}`,
      name: normalizedBrandName,
    };
    store.brands.push(brand);
  }

  const existing = store.products.find((product) => product.id === input.id);

  const nextProduct: ProductRecord = existing
    ? {
        ...existing,
        ...input,
        categoryName: category.name,
        brandName: brand.name,
        brandId: brand.id,
        supplierId: input.supplierId ?? existing.supplierId,
        supplierName: supplier?.name ?? existing.supplierName,
        expiryDate: input.expiryDate ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive ?? true,
        archivedAt: input.isActive === false ? nowIso() : null,
        updatedAt: nowIso(),
      }
    : {
        id: `prod-${slugify(input.name)}-${nanoid(6)}`,
        branchId,
        name: input.name,
        description: input.description ?? "",
        categoryId: input.categoryId,
        categoryName: category.name,
        brandId: brand.id,
        brandName: brand.name,
        supplierId: input.supplierId ?? "",
        supplierName: supplier?.name ?? "",
        flavor: input.flavor ?? "",
        sizeLabel: input.sizeLabel ?? "",
        sku: input.sku,
        barcode: input.barcode,
        salePrice: input.salePrice,
        wholesalePrice: input.wholesalePrice,
        discountPrice: input.discountPrice ?? null,
        costPrice: input.costPrice,
        stockQuantity: input.stockQuantity,
        reorderPoint: input.reorderPoint,
        expiryDate: input.expiryDate ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive ?? true,
        archivedAt: input.isActive === false ? nowIso() : null,
        updatedAt: nowIso(),
        lastRestockedAt: input.stockQuantity > 0 ? nowIso() : null,
      };

  if (existing) {
    const index = store.products.findIndex((product) => product.id === existing.id);
    store.products[index] = nextProduct;
  } else {
    store.products.unshift(nextProduct);
  }

  return nextProduct;
}

export function archiveDemoProduct(productId: string) {
  const store = getDemoStore();
  const product = store.products.find((item) => item.id === productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  product.isActive = false;
  product.archivedAt = nowIso();
  product.updatedAt = nowIso();
  return product;
}

export function adjustDemoInventory(input: InventoryAdjustmentInput, actor: AppSession) {
  const store = getDemoStore();
  const product = store.products.find((item) => item.id === input.productId);

  if (!product) {
    throw new Error("Product not found.");
  }

  const previousQuantity = product.stockQuantity;
  const newQuantity = previousQuantity + input.quantityDelta;

  if (newQuantity < 0) {
    throw new Error("Adjustment would result in negative stock.");
  }

  product.stockQuantity = newQuantity;
  product.updatedAt = nowIso();
  product.lastRestockedAt = input.quantityDelta > 0 ? nowIso() : product.lastRestockedAt;

  const movement: StockMovementRecord = {
    id: `move-${nanoid(8)}`,
    productId: product.id,
    productName: product.name,
    movementType: input.quantityDelta >= 0 ? "restock" : "adjustment",
    quantityDelta: input.quantityDelta,
    previousQuantity,
    newQuantity,
    note: input.note,
    performedBy: actor.userId,
    performedByName: actor.fullName,
    supplierId: input.supplierId ?? null,
    createdAt: nowIso(),
  };

  store.stockMovements.unshift(movement);

  if (newQuantity <= product.reorderPoint) {
    store.alerts.unshift({
      id: `alert-${nanoid(8)}`,
      severity: newQuantity === 0 ? "critical" : "warning",
      title: newQuantity === 0 ? "Out of stock" : "Low stock threshold reached",
      message: `${product.name} ${product.flavor} now has only ${newQuantity} units remaining.`,
      productId: product.id,
      productName: product.name,
      createdAt: nowIso(),
    });
  }

  return movement;
}

function buildSaleItems(input: PosSaleInput, store: DemoStore) {
  return input.items.map((item) => {
    const product = store.products.find((entry) => entry.id === item.productId);

    if (!product) {
      throw new Error("A POS item references a missing product.");
    }

    if (product.stockQuantity < item.quantity) {
      throw new Error(`Not enough stock for ${product.name}.`);
    }

    const pricingTier = item.pricingTier ?? "retail";
    const defaultPrice = resolveTierPrice(product, pricingTier);
    const unitPrice = item.unitPrice || defaultPrice;
    const lineTotal = unitPrice * item.quantity - item.discountAmount;
    const lineProfit = lineTotal - product.costPrice * item.quantity;

    return {
      line: {
        id: `line-${nanoid(8)}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: item.quantity,
        unitPrice,
        pricingTier,
        unitCost: product.costPrice,
        discountAmount: item.discountAmount,
        lineTotal,
        lineProfit,
      } satisfies SaleItemRecord,
      product,
    };
  });
}

export function createDemoSale(input: PosSaleInput, actor: AppSession) {
  const store = getDemoStore();
  const items = buildSaleItems(input, store);
  const subtotal = items.reduce((sum, item) => sum + item.line.unitPrice * item.line.quantity, 0);
  const lineDiscounts = items.reduce((sum, item) => sum + item.line.discountAmount, 0);
  const extraDiscount = input.discountAmount ?? 0;
  const totalDiscount = lineDiscounts + extraDiscount;
  const totalAmount = subtotal - totalDiscount;
  const saleIndex = store.sales.length + 1;

  const sale: SaleRecord = {
    id: `sale-${nanoid(8)}`,
    branchId,
    invoiceNumber: createInvoiceNumber(saleIndex),
    employeeId: actor.userId,
    employeeName: actor.fullName,
    status: "completed",
    paymentMethod: input.paymentMethod,
    paymentStatus: "paid",
    subtotal,
    discountAmount: totalDiscount,
    taxAmount: 0,
    totalAmount,
    notes: input.notes ?? "",
    customerName: input.customerName ?? null,
    createdAt: nowIso(),
    items: items.map((item) => item.line),
  };

  items.forEach(({ product, line }) => {
    const previousQuantity = product.stockQuantity;
    product.stockQuantity -= line.quantity;
    product.updatedAt = nowIso();

    store.stockMovements.unshift({
      id: `move-${nanoid(8)}`,
      productId: product.id,
      productName: product.name,
      movementType: "sale",
      quantityDelta: -line.quantity,
      previousQuantity,
      newQuantity: product.stockQuantity,
      note: `Sale ${sale.invoiceNumber}`,
      performedBy: actor.userId,
      performedByName: actor.fullName,
      createdAt: nowIso(),
    });

    if (product.stockQuantity <= product.reorderPoint) {
      store.alerts.unshift({
        id: `alert-${nanoid(8)}`,
        severity: product.stockQuantity === 0 ? "critical" : "warning",
        title:
          product.stockQuantity === 0
            ? "Product depleted after sale"
            : "Low stock alert after sale",
        message: `${product.name} ${product.flavor} dropped to ${product.stockQuantity} units.`,
        productId: product.id,
        productName: product.name,
        createdAt: nowIso(),
      });
    }
  });

  store.sales.unshift(sale);

  const employee = store.employees.find((entry) => entry.id === actor.userId);
  if (employee) {
    employee.transactionCount += 1;
    employee.totalSales += sale.items.reduce((sum, item) => sum + item.quantity, 0);
    employee.totalRevenue += sale.totalAmount;
    employee.lastLoginAt = nowIso();
  }

  return sale;
}
