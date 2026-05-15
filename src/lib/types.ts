export type UserRole = "admin" | "employee";
export type SessionMode = "supabase" | "demo";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "mixed";
export type PaymentStatus = "paid" | "pending" | "refunded" | "void";
export type SaleStatus = "completed" | "cancelled" | "draft";
export type StockMovementType =
  | "restock"
  | "sale"
  | "adjustment"
  | "return"
  | "void";
export type AlertSeverity = "info" | "warning" | "critical";

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
  discountAmount: number;
  lineTotal: number;
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
  items: SaleItemRecord[];
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
  todayTransactions: number;
  averageBasket: number;
  activeSkus: number;
  lowStockCount: number;
  expiringSoonCount: number;
  pendingPayments: number;
}

export interface DashboardSnapshot {
  session: AppSession;
  summary: DashboardSummary;
  salesTrend: DailySalesPoint[];
  products: ProductRecord[];
  sales: SaleRecord[];
  employees: EmployeeRecord[];
  suppliers: SupplierRecord[];
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
  quantity: number;
  discountAmount: number;
  stockQuantity: number;
}

export interface PosSaleInput {
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
  }>;
  paymentMethod: PaymentMethod;
  notes?: string;
  customerName?: string;
  discountAmount?: number;
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
