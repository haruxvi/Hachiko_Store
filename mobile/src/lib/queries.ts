import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useSession } from './session';
import type { Category, Inventory, Me, MyOrder, Paged, ProductCard, ProductDetail, SellerOrderDetail, SellerOrders, SellerToday } from './types';

// Consultas de datos (caché compartida con TanStack Query).

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/catalog/categories', { auth: false }), staleTime: 10 * 60_000 });

export type ProductQuery = { q?: string; categoria?: string; orden?: 'recent' | 'price-asc' | 'price-desc'; stock?: boolean };

/** Vitrina con scroll infinito (páginas de 24). */
export function useProducts(f: ProductQuery) {
  return useInfiniteQuery({
    queryKey: ['products', f],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const p = new URLSearchParams({ pagina: String(pageParam), mostrar: '24' });
      if (f.q) p.set('q', f.q);
      if (f.categoria) p.set('categoria', f.categoria);
      if (f.orden) p.set('orden', f.orden);
      if (f.stock) p.set('stock', '1');
      return api<Paged<ProductCard>>(`/catalog/products?${p}`, { auth: false, signal });
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export const useProduct = (slug: string) =>
  useQuery({ queryKey: ['product', slug], queryFn: () => api<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`, { auth: false }) });

export function useMe() {
  const authed = useSession((s) => s.status === 'authed');
  return useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), enabled: authed });
}

export function useMyOrders() {
  const authed = useSession((s) => s.status === 'authed');
  return useQuery({ queryKey: ['my-orders'], queryFn: () => api<MyOrder[]>('/me/orders'), enabled: authed });
}

// ── Vendedor ──
export function useSellerToday() {
  const seller = useSession((s) => s.user?.role === 'SELLER');
  return useQuery({ queryKey: ['seller', 'today'], queryFn: () => api<SellerToday>('/seller/today'), refetchInterval: 60_000, enabled: seller });
}

export function useSellerOrders(estado: 'empacar' | 'enviadas', q: string) {
  return useInfiniteQuery({
    queryKey: ['seller', 'orders', estado, q],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api<SellerOrders>(`/seller/orders?${new URLSearchParams({ estado, q, pagina: String(pageParam) })}`, { signal }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export const useSellerOrder = (id: string) =>
  useQuery({ queryKey: ['seller', 'order', id], queryFn: () => api<SellerOrderDetail>(`/seller/orders/${encodeURIComponent(id)}`) });

export function useInventory(q: string, low: boolean) {
  return useInfiniteQuery({
    queryKey: ['seller', 'inventory', q, low],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api<Inventory>(`/seller/inventory?${new URLSearchParams({ q, stock: low ? 'bajo' : 'todo', pagina: String(pageParam) })}`, { signal }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
