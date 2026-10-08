// Formas de los datos de la API v1 (espejo de src/lib/api/dto.ts y de las rutas).

export type Role = 'CLIENT' | 'SELLER';
export type SessionUser = { email: string; firstName: string | null; role: Role };
export type StockState = 'ok' | 'low' | 'out';

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  nameKorean: string | null;
  priceCLP: number;
  image: string | null;
  category: { name: string; slug: string } | null;
  stockState: StockState;
  left: number | null;
};

export type ProductDetail = ProductCard & {
  images: string[];
  description: string;
  weightGrams: number;
  maxQuantity: number;
  together: ProductCard[];
  webUrl: string;
};

export type Paged<T> = { items: T[]; page: number; totalPages: number; total: number };
export type Category = { slug: string; name: string; description: string | null };

export type OrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type Me = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  emailVerified: boolean;
  twoFactor: boolean;
  consentMarketing: boolean;
  memberSince: string;
  orderCount: number;
  lastOrder: { orderNumber: number; status: OrderStatus; shippingMethod: string } | null;
};

export type MyOrder = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  paymentStatus: string;
  shippingMethod: 'PICKUP' | 'STARKEN' | 'CORREOS_CHILE';
  shippingLabel: string;
  trackingUrl: string | null;
  totalCLP: number;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: { name: string; quantity: number; unitPriceCLP: number }[];
};

// ── Vendedor ──
export type Alert = { level: 'critical' | 'warning' | 'info'; message: string };
export type SellerToday = {
  kpis: {
    toPack: number; preparing: number; awaitingPayment: number;
    salesToday: number; ordersToday: number; salesWeek: number; salesMonth: number; lowStockCount: number;
  };
  toPack: { id: string; orderNumber: number; status: OrderStatus; isPickup: boolean; commune: string | null; itemCount: number; totalCLP: number; createdAt: string; flagged: boolean }[];
  lowStock: { id: string; name: string; stock: number; threshold: number }[];
  alerts: Alert[];
};

export type SellerOrderRow = {
  id: string; orderNumber: number; status: OrderStatus; recipientName: string; isPickup: boolean;
  shippingLabel: string; commune: string | null; itemCount: number; totalCLP: number; createdAt: string; flagged: boolean;
};
export type SellerOrders = Paged<SellerOrderRow> & { counts: { empacar: number; enviadas: number } };

export type SellerOrderDetail = {
  id: string; orderNumber: number; status: OrderStatus; totalCLP: number; subtotalCLP: number; shippingCLP: number;
  shippingMethod: string; shippingLabel: string; isPickup: boolean; trackingNumber: string | null; trackingUrl: string | null;
  createdAt: string; paidAt: string | null; shippedAt: string | null; canShip: boolean;
  items: { name: string; sku: string; quantity: number; unitPriceCLP: number }[];
  recipientName: string; shippingStreet: string | null; shippingNumber: string | null; shippingApartment: string | null;
  shippingCommune: string | null; shippingRegion: string | null; shippingPhone: string; shippingNotes: string | null;
  risk: { score: number; reasons: string[] } | null;
};

export type InventoryRow = {
  id: string; sku: string; name: string; category: string; image: string | null;
  stock: number; reserved: number; available: number; threshold: number; isLow: boolean;
};
export type Inventory = Paged<InventoryRow> & { lowCount: number };
export type ScannedProduct = {
  id: string; sku: string; name: string; category: string; priceCLP: number; image: string | null;
  stock: number; available: number; threshold: number; archived: boolean;
};
