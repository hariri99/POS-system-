export type UserRole = "admin" | "employee";
export type SessionMode = "supabase" | "demo";
export type PaymentMethod = "cash" | "whish_money";
export type PaymentStatus = "paid" | "pending" | "partially_refunded" | "refunded" | "void";
export type SaleStatus = "completed" | "cancelled" | "draft";
export type SaleRefundScope = "order" | "item";
export type ProductPricingTier = "retail" | "wholesale" | "discount";
export type StockMovementType =
  | "restock"
  | "sale"
  | "adjustment"
  | "return"
  | "void";
export type AlertSeverity = "info" | "warning" | "critical";
export type ExpenseCategory =
  | "rent"
  | "salary"
  | "electricity"
  | "delivery"
  | "imports"
  | "customs"
  | "packaging"
  | "marketing"
  | "maintenance"
  | "other";

export interface AppSession {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string;
  branchName: string;
  mode: SessionMode;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
}

export interface BrandRecord {
  id: string;
  name: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  restockCount: number;
  activeProducts: number;
}

export interface ProductRecord {
  id: string;
  branchId: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  brandId: string;
  brandName: string;
  supplierId: string;
  supplierName: string;
  flavor: string;
  sizeLabel: string;
  sku: string;
  barcode: string;
  salePrice: number;
  wholesalePrice: number;
  discountPrice: number | null;
  costPrice: number;
  stockQuantity: number;
  reorderPoint: number;
  expiryDate: string | null;
  imageUrl: string | null;
  isActive: boolean;
  archivedAt: string | null;
  updatedAt: string;
  lastRestockedAt: string | null;
}

export interface StockMovementRecord {
  id: string;
  productId: string;
  productName: string;
  movementType: StockMovementType;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  note: string;
  performedBy: string;
  performedByName: string;
  supplierId?: string | null;
  createdAt: string;
}

export interface SaleItemRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  pricingTier: ProductPricingTier;
  unitCost: number;
  discountAmount: number;
  lineTotal: number;
  lineProfit: number;
  refundedQuantity: number;
  refundedAt: string | null;
  refundReason: string | null;
}

export interface RefundEventItemRecord {
  saleItemId: string;
  productName: string;
  quantity: number;
  amount: number;
}

export interface RefundEventRecord {
  id: string;
  actorId: string | null;
  actorName: string;
  createdAt: string;
  reason: string | null;
  amount: number;
  items: RefundEventItemRecord[];
}

export interface SaleRecord {
  id: string;
  branchId: string;
  invoiceNumber: string;
  employeeId: string;
  employeeName: string;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string;
  customerName: string | null;
  createdAt: string;
  paidAt: string | null;
  refundedAmount: number;
  refundedAt: string | null;
  refundReason: string | null;
  items: SaleItemRecord[];
  refundEvents: RefundEventRecord[];
}

export interface SaleRefundInput {
  scope: SaleRefundScope;
  saleItemId?: string;
  quantity?: number;
  reason?: string;
}

export interface EmployeeRecord {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  branchId: string;
  branchName: string;
  phone: string;
  status: "active" | "inactive";
  lastLoginAt: string | null;
  totalSales: number;
  totalRevenue: number;
  transactionCount: number;
}

export interface ExpenseRecord {
  id: string;
  branchId: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  notes: string;
  incurredOn: string;
  recurring: boolean;
  createdAt: string;
}

export interface AlertRecord {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  productId: string | null;
  productName: string | null;
  createdAt: string;
}

export interface DailySalesPoint {
  label: string;
  revenue: number;
  transactions: number;
}

export interface DashboardSummary {
  todayRevenue: number;
  todayNetProfit: number;
  todayTransactions: number;
  averageBasket: number;
  activeSkus: number;
  lowStockCount: number;
  expiringSoonCount: number;
  pendingPayments: number;
  weeklyProfit: number;
  monthlyProfit: number;
  inventoryValue: number;
  totalExpenses: number;
}

export interface DashboardSnapshot {
  session: AppSession;
  summary: DashboardSummary;
  salesTrend: DailySalesPoint[];
  products: ProductRecord[];
  sales: SaleRecord[];
  employees: EmployeeRecord[];
  suppliers: SupplierRecord[];
  expenses: ExpenseRecord[];
  alerts: AlertRecord[];
  stockMovements: StockMovementRecord[];
  categories: CategoryRecord[];
  brands: BrandRecord[];
}

export interface PosCartLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  unitPrice: number;
  pricingTier: ProductPricingTier;
  retailPrice: number;
  wholesalePrice: number;
  discountPrice: number | null;
  costPrice: number;
  quantity: number;
  discountAmount: number;
  stockQuantity: number;
}

export interface PosSaleInput {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    pricingTier: ProductPricingTier;
    discountAmount: number;
  }>;
  paymentMethod: PaymentMethod;
  paymentStatus: "paid" | "pending";
  notes?: string;
  customerName?: string;
}

export interface ProductMutationInput {
  id?: string;
  name: string;
  description?: string;
  categoryId: string;
  brandId?: string;
  brandName: string;
  supplierId?: string | null;
  flavor?: string;
  sizeLabel?: string;
  sku: string;
  barcode: string;
  salePrice: number;
  wholesalePrice: number;
  discountPrice?: number | null;
  costPrice: number;
  stockQuantity: number;
  reorderPoint: number;
  expiryDate?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface InventoryAdjustmentInput {
  productId: string;
  quantityDelta: number;
  note: string;
  supplierId?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}
