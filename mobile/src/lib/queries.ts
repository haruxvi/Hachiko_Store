import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useSession } from './session';
import type { Category, Inventory, Me, MyOrder, Paged, ProductCard, ProductDetail, SellerCategory, SellerOrderDetail, SellerOrders, SellerProduct, SellerProductRow, SellerToday } from './types';

// Consultas de datos (caché compartida con TanStack Query).

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/catalog/categories', { auth: false }), staleTime: 10 * 60_000 });

export type ProductQuery = { q?: string; categoria?: string; orden?: 'recent' | 'price-asc' | 'price-desc'; stock?: boolean };

/** Tamaños de página que acepta la API (los mismos de "Mostrar" en la web). */
export const PAGE_SIZES = [12, 24, 48] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

function productParams(f: ProductQuery, page: number, size: PageSize) {
  const p = new URLSearchParams({ pagina: String(page), mostrar: String(size) });
  if (f.q) p.set('q', f.q);
  if (f.categoria) p.set('categoria', f.categoria);
  if (f.orden) p.set('orden', f.orden);
  if (f.stock) p.set('stock', '1');
  return p;
}

/** Vitrina con scroll infinito (páginas de 24). */
export function useProducts(f: ProductQuery) {
  return useInfiniteQuery({
    queryKey: ['products', f],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => api<Paged<ProductCard>>(`/catalog/products?${productParams(f, pageParam, 24)}`, { auth: false, signal }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

/** Una página del catálogo (Buscar: páginas numeradas, como la web). Mientras
 *  carga la siguiente se sigue viendo la actual. */
export function useProductPage(f: ProductQuery, page: number, size: PageSize) {
  return useQuery({
    queryKey: ['products-page', f, page, size],
    queryFn: ({ signal }) => api<Paged<ProductCard>>(`/catalog/products?${productParams(f, page, size)}`, { auth: false, signal }),
    placeholderData: keepPreviousData,
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

/** "Mis pedidos" por páginas (mismos tamaños que la trastienda). */
export function useMyOrdersPage(page: number, size: ListPageSize) {
  const authed = useSession((s) => s.status === 'authed');
  return useQuery({
    queryKey: ['my-orders', 'page', page, size],
    queryFn: ({ signal }) => api<Paged<MyOrder>>(`/me/orders?${new URLSearchParams({ pagina: String(page), mostrar: String(size) })}`, { signal }),
    enabled: authed,
    placeholderData: keepPreviousData,
  });
}

// ── Vendedor ──
export function useSellerToday() {
  const seller = useSession((s) => s.user?.role === 'SELLER');
  return useQuery({ queryKey: ['seller', 'today'], queryFn: () => api<SellerToday>('/seller/today'), refetchInterval: 60_000, enabled: seller });
}

/** Tamaños de página de las listas (trastienda y Mis pedidos): los mismos del panel web. */
export const LIST_PAGE_SIZES = [10, 20, 50, 100] as const;
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];

export function useSellerOrders(estado: 'empacar' | 'enviadas', q: string, page: number, size: ListPageSize) {
  return useQuery({
    queryKey: ['seller', 'orders', estado, q, page, size],
    queryFn: ({ signal }) => api<SellerOrders>(`/seller/orders?${new URLSearchParams({ estado, q, pagina: String(page), mostrar: String(size) })}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export const useSellerOrder = (id: string) =>
  useQuery({ queryKey: ['seller', 'order', id], queryFn: () => api<SellerOrderDetail>(`/seller/orders/${encodeURIComponent(id)}`) });

/** Tras crear o editar el catálogo: refresca la trastienda y también la vitrina. */
export function refreshCatalog(qc: QueryClient) {
  for (const key of ['seller', 'products', 'products-page', 'categories', 'product']) void qc.invalidateQueries({ queryKey: [key] });
}

export type ProductStatus = 'activos' | 'archivados';

export function useSellerProducts(q: string, estado: ProductStatus, categoria: string | undefined, page: number, size: ListPageSize) {
  return useQuery({
    queryKey: ['seller', 'products', q, estado, categoria, page, size],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams({ q, estado, pagina: String(page), mostrar: String(size) });
      if (categoria) p.set('categoria', categoria);
      return api<Paged<SellerProductRow>>(`/seller/products?${p}`, { signal });
    },
    placeholderData: keepPreviousData,
  });
}

export const useSellerProduct = (id: string | undefined) =>
  useQuery({ queryKey: ['seller', 'product-edit', id], queryFn: () => api<SellerProduct>(`/seller/products/${encodeURIComponent(id!)}`), enabled: !!id });

export function useSellerCategories(q: string, archivadas: boolean, page: number, size: ListPageSize) {
  return useQuery({
    queryKey: ['seller', 'categories', q, archivadas, page, size],
    queryFn: ({ signal }) =>
      api<Paged<SellerCategory>>(`/seller/categories?${new URLSearchParams({ q, estado: archivadas ? 'archivadas' : 'activas', pagina: String(page), mostrar: String(size) })}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export const useSellerCategory = (id: string | undefined) =>
  useQuery({ queryKey: ['seller', 'category', id], queryFn: () => api<SellerCategory>(`/seller/categories/${encodeURIComponent(id!)}`), enabled: !!id });

/** Todas las categorías activas (para elegir una en el formulario de producto). */
export const useCategoryOptions = () =>
  useQuery({ queryKey: ['seller', 'categories', 'options'], queryFn: () => api<Paged<SellerCategory>>('/seller/categories?mostrar=100'), staleTime: 60_000 });

export function useInventory(q: string, low: boolean, page: number, size: ListPageSize) {
  return useQuery({
    queryKey: ['seller', 'inventory', q, low, page, size],
    queryFn: ({ signal }) => api<Inventory>(`/seller/inventory?${new URLSearchParams({ q, stock: low ? 'bajo' : 'todo', pagina: String(page), mostrar: String(size) })}`, { signal }),
    placeholderData: keepPreviousData,
  });
}
