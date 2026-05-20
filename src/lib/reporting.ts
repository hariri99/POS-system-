import {
  getNetLineProfit,
  getNetLineTotal,
  getRefundableQuantity,
  getSaleNetTotal,
} from "@/lib/sale-math";
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfYear,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfYear,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import {
  type DashboardSummary,
  type DashboardSnapshot,
  type ExpenseRecord,
  type ProductPricingTier,
  type ProductRecord,
  type SaleRecord,
} from "@/lib/types";

type ResolvedLineMetrics = {
  productId: string;
  productName: string;
  categoryName: string;
  revenue: number;
  profit: number;
  cost: number;
  quantity: number;
  pricingTier: ProductPricingTier;
};

type CategoryAccumulator = {
  categoryName: string;
  revenue: number;
  netProfit: number;
  unitsSold: number;
  inventoryValue: number;
};

export interface ReportKpi {
  todayRevenue: number;
  todayNetProfit: number;
  weeklyRevenue: number;
  weeklyNetProfit: number;
  monthlyRevenue: number;
  monthlyNetProfit: number;
  inventoryValue: number;
  totalExpenses: number;
  lowStockProducts: number;
  comparisonToPreviousWeek: number;
}

export interface ProfitTrendPoint {
  label: string;
  fullLabel: string;
  revenue: number;
  netProfit: number;
}

export interface SalesTrendPoint {
  label: string;
  fullLabel: string;
  revenue: number;
  netProfit: number;
  transactions: number;
}

export interface ProductPerformancePoint {
  productId: string;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
  netProfit: number;
  marginRate: number;
  retailRevenue: number;
  wholesaleRevenue: number;
  discountRevenue: number;
}

export interface CategoryPerformancePoint {
  categoryName: string;
  revenue: number;
  netProfit: number;
  unitsSold: number;
  inventoryValue: number;
  marginRate: number;
  profitShare: number;
}

export interface ExecutiveReport {
  kpis: ReportKpi;
  monthlyProfitTrend: ProfitTrendPoint[];
  salesTrend: SalesTrendPoint[];
  topProducts: ProductPerformancePoint[];
  lowestMarginProducts: ProductPerformancePoint[];
  categoryPerformance: CategoryPerformancePoint[];
  expiryAlerts: ExpiryInsightPoint[];
  lowStockIntelligence: LowStockInsightPoint[];
  employeePerformance: EmployeePerformancePoint[];
}

export interface ExpiryInsightPoint {
  productId: string;
  productName: string;
  categoryName: string;
  expiryDate: string | null;
  daysRemaining: number;
  stockQuantity: number;
  inventoryValue: number;
}

export interface LowStockInsightPoint {
  productId: string;
  productName: string;
  stockQuantity: number;
  reorderPoint: number;
  soldLast30Days: number;
  estimatedDaysToStockout: number | null;
}

export interface EmployeePerformancePoint {
  employeeId: string;
  employeeName: string;
  orders: number;
  revenue: number;
  netProfit: number;
}

function getCompletedSales(sales: SaleRecord[]) {
  return sales.filter(
    (sale) =>
      sale.status === "completed" &&
      (sale.paymentStatus === "paid" || sale.paymentStatus === "partially_refunded") &&
      getSaleNetTotal(sale) > 0,
  );
}

function getSaleTimelineDate(sale: SaleRecord) {
  return new Date(sale.paidAt ?? sale.createdAt);
}

function getProductMaps(products: ProductRecord[]) {
  const byId = new Map(products.map((product) => [product.id, product]));
  return { byId };
}

function resolveLineMetrics(
  sale: SaleRecord,
  productsById: Map<string, ProductRecord>,
): ResolvedLineMetrics[] {
  const baseMetrics = sale.items
    .map((item) => {
      const quantity = getRefundableQuantity(item);
      if (quantity <= 0) {
        return null;
      }

      const product = productsById.get(item.productId);
      const fallbackCost = product?.costPrice ?? 0;
      const hasStoredFinancials =
        (typeof item.unitCost === "number" && item.unitCost > 0) ||
        (typeof item.lineProfit === "number" && item.lineProfit !== 0) ||
        item.pricingTier !== "retail";
      const unitCost = hasStoredFinancials ? item.unitCost : fallbackCost;
      const baseRevenue = getNetLineTotal(item);
      const baseProfit = hasStoredFinancials
        ? getNetLineProfit(item)
        : baseRevenue - unitCost * quantity;

      return {
        productId: item.productId,
        productName: item.productName,
        categoryName: product?.categoryName ?? "Uncategorized",
        quantity,
        cost: unitCost * quantity,
        revenue: baseRevenue,
        profit: baseProfit,
        pricingTier:
          "pricingTier" in item && item.pricingTier
            ? item.pricingTier
            : ("retail" satisfies ProductPricingTier),
      };
    })
    .filter((line): line is ResolvedLineMetrics => line !== null);

  const lineDiscountTotal = sale.items.reduce((sum, item) => sum + item.discountAmount, 0);
  const extraDiscount = Math.max(0, sale.discountAmount - lineDiscountTotal);
  const baseRevenueTotal = baseMetrics.reduce((sum, line) => sum + line.revenue, 0);

  if (extraDiscount <= 0 || baseRevenueTotal <= 0) {
    return baseMetrics;
  }

  return baseMetrics.map((line, index) => {
    const isLast = index === baseMetrics.length - 1;
    const allocatedDiscount = isLast
      ? extraDiscount -
        baseMetrics
          .slice(0, -1)
          .reduce((sum, candidate) => sum + (extraDiscount * candidate.revenue) / baseRevenueTotal, 0)
      : (extraDiscount * line.revenue) / baseRevenueTotal;

    return {
      ...line,
      revenue: Math.max(0, line.revenue - allocatedDiscount),
      profit: line.profit - allocatedDiscount,
    };
  });
}

function sumExpensesInInterval(expenses: ExpenseRecord[], start: Date, end: Date) {
  return expenses
    .filter((expense) =>
      isWithinInterval(new Date(expense.incurredOn), {
        start,
        end,
      }),
    )
    .reduce((sum, expense) => sum + expense.amount, 0);
}

export function buildDashboardSummary({
  products,
  sales,
  expenses,
}: Pick<DashboardSnapshot, "products" | "sales" | "expenses">): DashboardSummary {
  const completedSales = getCompletedSales(sales);
  const { byId: productsById } = getProductMaps(products);
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const settledTodaySales = completedSales.filter((sale) =>
    isWithinInterval(getSaleTimelineDate(sale), { start: todayStart, end: todayEnd }),
  );
  const weekSales = completedSales.filter((sale) =>
    isWithinInterval(getSaleTimelineDate(sale), { start: weekStart, end: weekEnd }),
  );
  const monthSales = completedSales.filter((sale) =>
    isWithinInterval(getSaleTimelineDate(sale), { start: monthStart, end: monthEnd }),
  );

  const todayProfit = settledTodaySales.reduce(
    (sum, sale) =>
      sum +
      resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
    0,
  );
  const weeklyProfit = weekSales.reduce(
    (sum, sale) =>
      sum +
      resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
    0,
  );
  const monthlyProfit = monthSales.reduce(
    (sum, sale) =>
      sum +
      resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
    0,
  );

  const todayRevenue = settledTodaySales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
  const todayTransactions = settledTodaySales.length;
  const monthlyExpenses = sumExpensesInInterval(expenses, monthStart, monthEnd);

  return {
    todayRevenue,
    todayNetProfit: todayProfit - sumExpensesInInterval(expenses, todayStart, todayEnd),
    todayTransactions,
    averageBasket: todayTransactions ? todayRevenue / todayTransactions : 0,
    activeSkus: products.filter((product) => product.isActive).length,
    lowStockCount: products.filter((product) => product.stockQuantity <= product.reorderPoint).length,
    expiringSoonCount: products.filter((product) => {
      if (!product.expiryDate) {
        return false;
      }

      return differenceInCalendarDays(new Date(product.expiryDate), new Date()) <= 30;
    }).length,
    pendingPayments: sales.filter((sale) => sale.paymentStatus === "pending").length,
    weeklyProfit: weeklyProfit - sumExpensesInInterval(expenses, weekStart, weekEnd),
    monthlyProfit: monthlyProfit - monthlyExpenses,
    inventoryValue: products.reduce((sum, product) => sum + product.costPrice * product.stockQuantity, 0),
    totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
  };
}

export function buildExecutiveReport(snapshot: DashboardSnapshot): ExecutiveReport {
  const productsById = getProductMaps(snapshot.products).byId;
  const completedSales = getCompletedSales(snapshot.sales);
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const previousWeekStart = subWeeks(currentWeekStart, 1);
  const previousWeekEnd = subDays(currentWeekStart, 1);
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const currentYearStart = startOfYear(now);
  const currentYearEnd = endOfYear(now);

  const currentWeekSales = completedSales.filter((sale) =>
    isWithinInterval(getSaleTimelineDate(sale), {
      start: currentWeekStart,
      end: endOfWeek(now, { weekStartsOn: 1 }),
    }),
  );
  const previousWeekSales = completedSales.filter((sale) =>
    isWithinInterval(getSaleTimelineDate(sale), {
      start: previousWeekStart,
      end: previousWeekEnd,
    }),
  );
  const currentMonthSales = completedSales.filter((sale) =>
    isWithinInterval(getSaleTimelineDate(sale), { start: currentMonthStart, end: currentMonthEnd }),
  );

  const monthlyWindows = eachMonthOfInterval({
    start: currentYearStart,
    end: currentYearEnd,
  });

  const monthlyProfitTrend = monthlyWindows.map((monthDate) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const sales = completedSales.filter((sale) =>
      isWithinInterval(getSaleTimelineDate(sale), { start: monthStart, end: monthEnd }),
    );
    const revenue = sales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
    const grossProfit = sales.reduce(
      (sum, sale) =>
        sum +
        resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
      0,
    );
    const expenses = sumExpensesInInterval(snapshot.expenses, monthStart, monthEnd);

    return {
      label: format(monthDate, "MMM"),
      fullLabel: format(monthDate, "MMMM yyyy"),
      revenue,
      netProfit: grossProfit - expenses,
    };
  });

  const salesTrendDays = eachDayOfInterval({
    start: currentMonthStart,
    end: endOfMonth(now),
  });
  const salesTrend = salesTrendDays.map((dayDate) => {
    const daySales = completedSales.filter((sale) =>
      startOfDay(getSaleTimelineDate(sale)).getTime() === dayDate.getTime(),
    );
    const revenue = daySales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
    const grossProfit = daySales.reduce(
      (sum, sale) =>
        sum +
        resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
      0,
    );
    const expenses = sumExpensesInInterval(snapshot.expenses, startOfDay(dayDate), endOfDay(dayDate));

    return {
      label: format(dayDate, "d"),
      fullLabel: format(dayDate, "dd MMM yyyy"),
      revenue,
      netProfit: grossProfit - expenses,
      transactions: daySales.length,
    };
  });

  const performanceByProduct = new Map<string, ProductPerformancePoint>();
  const performanceByCategory = new Map<string, CategoryAccumulator>();
  const performanceByEmployee = new Map<string, EmployeePerformancePoint>();

  completedSales.forEach((sale) => {
    const lines = resolveLineMetrics(sale, productsById);
    const saleProfit = lines.reduce((sum, line) => sum + line.profit, 0);

    const employeeBucket = performanceByEmployee.get(sale.employeeId) ?? {
      employeeId: sale.employeeId,
      employeeName: sale.employeeName,
      orders: 0,
      revenue: 0,
      netProfit: 0,
    };
    employeeBucket.orders += 1;
    employeeBucket.revenue += getSaleNetTotal(sale);
    employeeBucket.netProfit += saleProfit;
    performanceByEmployee.set(sale.employeeId, employeeBucket);

    lines.forEach((line) => {
      const productBucket = performanceByProduct.get(line.productId) ?? {
        productId: line.productId,
        productName: line.productName,
        categoryName: line.categoryName,
        unitsSold: 0,
        revenue: 0,
        netProfit: 0,
        marginRate: 0,
        retailRevenue: 0,
        wholesaleRevenue: 0,
        discountRevenue: 0,
      };

      productBucket.unitsSold += line.quantity;
      productBucket.revenue += line.revenue;
      productBucket.netProfit += line.profit;
      if (line.pricingTier === "retail") {
        productBucket.retailRevenue += line.revenue;
      } else if (line.pricingTier === "wholesale") {
        productBucket.wholesaleRevenue += line.revenue;
      } else {
        productBucket.discountRevenue += line.revenue;
      }

      performanceByProduct.set(line.productId, productBucket);

      const categoryBucket = performanceByCategory.get(line.categoryName) ?? {
        categoryName: line.categoryName,
        revenue: 0,
        netProfit: 0,
        unitsSold: 0,
        inventoryValue: 0,
      };

      categoryBucket.revenue += line.revenue;
      categoryBucket.netProfit += line.profit;
      categoryBucket.unitsSold += line.quantity;
      performanceByCategory.set(line.categoryName, categoryBucket);
    });
  });

  snapshot.products.forEach((product) => {
    const categoryBucket = performanceByCategory.get(product.categoryName) ?? {
      categoryName: product.categoryName,
      revenue: 0,
      netProfit: 0,
      unitsSold: 0,
      inventoryValue: 0,
    };
    categoryBucket.inventoryValue += product.stockQuantity * product.costPrice;
    performanceByCategory.set(product.categoryName, categoryBucket);
  });

  const topProducts = Array.from(performanceByProduct.values())
    .map((product) => ({
      ...product,
      marginRate: product.revenue > 0 ? product.netProfit / product.revenue : 0,
    }))
    .sort((left, right) => right.netProfit - left.netProfit);

  const lowestMarginProducts = [...topProducts]
    .filter((product) => product.unitsSold > 0)
    .sort((left, right) => left.marginRate - right.marginRate);

  const totalCategoryProfit = Array.from(performanceByCategory.values()).reduce(
    (sum, category) => sum + category.netProfit,
    0,
  );
  const categoryPerformance = Array.from(performanceByCategory.values())
    .map((category) => ({
      ...category,
      marginRate: category.revenue > 0 ? category.netProfit / category.revenue : 0,
      profitShare: totalCategoryProfit > 0 ? category.netProfit / totalCategoryProfit : 0,
    }))
    .sort((left, right) => right.netProfit - left.netProfit);

  const expiryAlerts = snapshot.products
    .filter((product) => product.expiryDate)
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      categoryName: product.categoryName,
      expiryDate: product.expiryDate,
      daysRemaining: differenceInCalendarDays(new Date(product.expiryDate!), now),
      stockQuantity: product.stockQuantity,
      inventoryValue: product.costPrice * product.stockQuantity,
    }))
    .filter((product) => product.daysRemaining <= 90)
    .sort((left, right) => left.daysRemaining - right.daysRemaining)
    .slice(0, 8);

  const lowStockIntelligence = snapshot.products
    .filter((product) => product.isActive && product.stockQuantity <= product.reorderPoint)
    .map((product) => {
      const soldLast30Days = completedSales.reduce((sum, sale) => {
        if (getSaleTimelineDate(sale) < subDays(now, 30)) {
          return sum;
        }

        return (
          sum +
          resolveLineMetrics(sale, productsById)
            .filter((line) => line.productId === product.id)
            .reduce((lineSum, line) => lineSum + line.quantity, 0)
        );
      }, 0);
      const dailyAverage = soldLast30Days / 30;

      return {
        productId: product.id,
        productName: product.name,
        stockQuantity: product.stockQuantity,
        reorderPoint: product.reorderPoint,
        soldLast30Days,
        estimatedDaysToStockout:
          dailyAverage > 0 ? Math.max(1, Math.round(product.stockQuantity / dailyAverage)) : null,
      };
    })
    .sort((left, right) => left.stockQuantity - right.stockQuantity)
    .slice(0, 8);

  const currentWeekRevenue = currentWeekSales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
  const currentWeekProfit = currentWeekSales.reduce(
    (sum, sale) =>
      sum +
      resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
    0,
  );
  const previousWeekProfit = previousWeekSales.reduce(
    (sum, sale) =>
      sum +
      resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
    0,
  );
  const comparisonToPreviousWeek =
    previousWeekProfit === 0 ? 0 : (currentWeekProfit - previousWeekProfit) / previousWeekProfit;
  const currentMonthRevenue = currentMonthSales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
  const currentMonthProfit = currentMonthSales.reduce(
    (sum, sale) =>
      sum +
      resolveLineMetrics(sale, productsById).reduce((lineSum, line) => lineSum + line.profit, 0),
    0,
  );

  return {
    kpis: {
      todayRevenue: snapshot.summary.todayRevenue,
      todayNetProfit: snapshot.summary.todayNetProfit,
      weeklyRevenue: currentWeekRevenue,
      weeklyNetProfit:
        currentWeekProfit -
        sumExpensesInInterval(snapshot.expenses, currentWeekStart, endOfWeek(now, { weekStartsOn: 1 })),
      monthlyRevenue: currentMonthRevenue,
      monthlyNetProfit:
        currentMonthProfit - sumExpensesInInterval(snapshot.expenses, currentMonthStart, currentMonthEnd),
      inventoryValue: snapshot.summary.inventoryValue,
      totalExpenses: snapshot.summary.totalExpenses,
      lowStockProducts: snapshot.summary.lowStockCount,
      comparisonToPreviousWeek,
    },
    monthlyProfitTrend,
    salesTrend,
    topProducts: topProducts.slice(0, 8),
    lowestMarginProducts: lowestMarginProducts.slice(0, 8),
    categoryPerformance,
    expiryAlerts,
    lowStockIntelligence,
    employeePerformance: Array.from(performanceByEmployee.values()).sort(
      (left, right) => right.netProfit - left.netProfit,
    ),
  };
}
