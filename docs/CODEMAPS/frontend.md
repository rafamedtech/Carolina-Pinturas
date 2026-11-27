<!-- Generado: 2026-11-27 | commit: aa2a705 | archivos: 32 páginas + ~150 componentes -->
# Frontend — siigo-pinturas

Nuxt 4 `app/`. Módulos: `@nuxt/ui`, `@vueuse/nuxt`, `@nuxt/eslint`; Supabase vía `app/plugins/supabase.client.ts`; capa `@rafamedtech/nuxt-shared`.
Guardas: `app/middleware/auth.global.ts` + `useAuth()` + `roleAccess.canAccessAppPath` (repartidor → solo /ventas; igualaciones → /igualaciones y detalle; /compras y su detalle: admin y mostrador (recepciones); /compras/nueva y /compras/cuentas-por-pagar solo admin; consulta sin rutas de alta/edición ni /configuracion). Públicas: /lista-precios, /login, /recuperar-contrasena.
Patrón: páginas finas que montan un componente de módulo. Listados con `ListPage`/`ListLayout`/`ListViews` locales (`app/components/list`) + `useTableQuery` (estado en URL). Guía: `docs/listados.md`, `docs/ui-components.md`.

## Páginas → componente raíz → API
/ → HomeDashboard (useSalesDashboard) → /api/dashboard/summary
/ventas, /igualaciones → OrdersOrderList (useOrderListTable) → /api/orders
/pedidos-internos → redirige a /ventas?view=internos
/ventas/nuevo-pedido, /ventas/nueva-cotizacion, /ventas/[id]/editar → OrdersOrderEditor (useOrderDraft) → /api/orders, /api/siigo/customers, /api/siigo/products
/ventas/[id] → OrdersOrderDetail → /api/orders/[id] (+ payments, siigo-invoice, status…)
/ventas/[id]/cotizacion, /ventas/[id]/ticket → impresión (sin layout; usePrinterSettings, useTicketPrinter, useBluetoothPrinter)
/clientes → CustomersCustomerCatalog (useCustomersCatalog) → /api/siigo/customers
/clientes/[id], /proveedores/[id] → detalle Siigo + CustomerEditForm, CustomerRolesCard, CustomerOrdersTable
/proveedores → redirige a /clientes?view=proveedores
/productos → ProductsProductCatalog (useProductManagementCatalog)
/productos/[id] → ProductDetailFields, InventoryProductStock, ProductActivity
/productos/nuevo, /productos/[id]/editar → ProductsProductEditor (useProductMutation, useProductWriteRecovery)
/lista-precios → PricesPriceCatalog (pública) → /api/catalog/prices
/compras → PurchasesPurchaseList · /compras/nueva → PurchaseDraftForm · /compras/[id] → PurchaseDetail · /compras/cuentas-por-pagar → PurchasePayables (usePurchaseAction)
/inventario → InventoryDashboard (useInventoryAction) → /api/inventory/*
/pagos → PaymentsPaymentList (usePaymentListTable) → /api/payments
/gastos → ExpensesExpenseList (useExpenseListTable) → /api/expenses
/repartidores, /repartidores/[id] → RepartidoresRepartidorCatalog / ListLayout → /api/repartidores
/reportes → ReportsPeriodControls, ReportsDashboard (useBusinessReports) → /api/reports/summary
/configuracion → SettingsInventory, SettingsUserPermissions, estado Siigo → /api/siigo/status, /api/users
/login, /recuperar-contrasena, /actualizar-contrasena → AuthCard + Auth* de la capa

## Componentes (`app/components`)
raíz: SiigoLoadingOverlay, TeamsMenu, UserMenu · auth: AuthCard · detail: DetailBreadcrumbs, DetailTabs (locales, no en la capa)
list: ListFilterFields, ListFiltersModal, ListLayout, ListPage, ListViews
orders/: OrderList(+Cards), OrderEditor, OrderDetail, OrderDetailItems, OrderLinesTable, OrderLineCards, OrderCustomerFields, OrderCustomerBalance, OrderCustomerCreateModal, OrderCancelModal, OrderHistoryList, OrderItemComposition, OrderItemDeleteModal, OrderFormActions, OrderDatePicker, OrderDateRangePicker, InternalOrderCustomersModal, …
orders/payments/: OrderPaymentsCard, OrderPaymentsModal, OrderPaymentSiigoModal, OrderPaymentDeleteModal, OrderHistoricalReceiptModal
orders/siigo/: OrderSiigoInvoiceCard, OrderSiigoInvoiceModal, OrderInvoiceCustomerModal, OrderHistoricalInvoiceModal
customers/: CustomerCatalog, CustomerEditForm, CustomerInvoiceRequirement, CustomerOrdersTable, CustomerRolesCard, AddModal, DeleteModal
products/: ProductCatalog, ProductEditor, ProductForm, Product{General,Price,Availability,Composition,Brand,Image}Fields, ProductDetailFields, ProductActivity(+Table), ProductPurchaseCost, ProductSearch, ProductStatusAction, ProductWriteRecovery, SatPicker
purchases/: PurchaseList, PurchaseDraftForm, PurchaseDraftTotals, PurchaseDetail, PurchaseReceipts, PurchaseInvoice(s), PurchasePayables, PayablesOverview, PayablesProviders, PurchaseDate, PurchaseReasonModal
inventory/: InventoryDashboard, InventoryStockTable, InventoryMovementForm, InventoryMovementsTable, InventoryRecentMovements, InventoryCountForm, InventoryCountProductPicker, InventoryWarehouseForm, InventoryWarehousePicker, InventoryOrderStock, InventoryProductStock, InventorySummary(+Metrics), InventoryValuation
home/: HomeDashboard, HomeStats, HomeSales, HomeChart, HomeBreakdowns, HomeTopProducts, HomePeriodSelect, HomeDateRangePicker, HomeMonthPicker
reports/: ReportsDashboard, ReportsPeriodControls, ReportsPeriodAnalysis, ReportsPaceComparison, ReportsWeeklySales, ReportsProfitStatement, ReportsCashFlowChart.client, ReportsExpenseDetails, ReportsPurchaseInvoices, ReportsSummaryCardsAdapter
expenses/: ExpenseList(+Cards), ExpenseAddModal · payments/: PaymentList(+Cards) · prices/: PriceCatalog, PriceList, PriceSearch, PriceDetailModal · repartidores/: RepartidorCatalog · settings/: Inventory, InventoryTracking, InventoryWarehouses, MembersList, UserPermissions · inbox/: InboxList, InboxMail

## Composables
useAuth · useTableQuery · useListFilterBindings · use{Order,Payment,Expense}ListTable · useOrderDraft · useCustomersCatalog · useProductsCatalog · useProductManagementCatalog · useProductMutation · useProductWriteRecovery · usePriceCatalog · usePurchaseAction · useInventoryAction · useRepartidoresCatalog · useSalesDashboard · useBusinessReports · useCsvExport · useSiigoLoading · usePrinterSettings · useTicketPrinter · useBluetoothPrinter

## app/utils
roleAccess (permisos) · orderPayment, orderStatus, orderDiscount, orderCreation, orderNavigation · purchaseFormat, purchasePayables, purchaseSupplierPdf · siigoCustomer*, siigoProduct*, siigoMexico{States,Cities,Country}, satFiscalRegimes · customerCatalog, productCatalogTabs · expense · tableQuery, dateFilterPresets, reportPeriods · navigationIcons · authSchemas, supabaseCookies
