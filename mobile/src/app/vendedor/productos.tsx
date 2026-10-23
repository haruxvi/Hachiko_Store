import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Chip, Divider, IconButton, ListItem, Skeleton, Txt } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { ProductArt, toneFor } from '@/ui/brand';
import { ExtendedFab } from '@/ui/Fab';
import { EmptyState, TopBar } from '@/ui/layout';
import { PageSizeChips, Pager } from '@/ui/Pager';
import { LIST_PAGE_SIZES, useCategoryOptions, useSellerProducts, type ListPageSize, type ProductStatus } from '@/lib/queries';
import { clp } from '@/lib/format';
import type { SellerProductRow } from '@/lib/types';

// Productos de la trastienda: buscar por nombre o SKU, filtrar por categoría,
// ver los archivados aparte, y tocar uno para editarlo. "+" crea uno nuevo.
export default function Products() {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<ProductStatus>('activos');
  const [categoria, setCategoria] = useState<string | undefined>();
  const [size, setSize] = useState<ListPageSize>(20);
  const [page, setPage] = useState(1);
  const list = useRef<FlatList<SellerProductRow>>(null);
  const categories = useCategoryOptions();
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  // Cualquier cambio de búsqueda o filtro vuelve a la página 1.
  const filterKey = `${q}|${estado}|${categoria ?? ''}|${size}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const products = useSellerProducts(q, estado, categoria, page, size);
  const goTo = (n: number) => {
    setPage(n);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title="Productos" />

      <View style={{ marginHorizontal: 16, marginTop: 4, height: 48, borderRadius: shape.full, backgroundColor: c.surfaceContainerHigh, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 10 }}>
        <Icon name="search" size={20} color={c.onSurfaceVariant} />
        <TextInput value={text} onChangeText={setText} placeholder="Nombre o SKU" placeholderTextColor={c.onSurfaceVariant} accessibilityLabel="Buscar producto" autoCapitalize="none" maxLength={100} style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.onSurface, height: 48 }} />
        {text.length > 0 && <IconButton icon="close" label="Borrar búsqueda" size={40} onPress={() => setText('')} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Chip label="Activos" selected={estado === 'activos'} onPress={() => setEstado('activos')} />
        <Chip label="Archivados" selected={estado === 'archivados'} onPress={() => setEstado('archivados')} />
        <View style={{ width: 1, height: 20, backgroundColor: c.outlineVariant, marginHorizontal: 4 }} />
        {(categories.data?.items ?? []).map((cat) => (
          <Chip key={cat.id} label={cat.name} selected={categoria === cat.id} onPress={() => setCategoria((v) => (v === cat.id ? undefined : cat.id))} />
        ))}
        <View style={{ width: 1, height: 20, backgroundColor: c.outlineVariant, marginHorizontal: 4 }} />
        <PageSizeChips sizes={LIST_PAGE_SIZES} value={size} onChange={setSize} />
      </ScrollView>

      <FlatList
        ref={list}
        data={products.data?.items ?? []}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={() => <Divider inset />}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
        keyboardDismissMode="on-drag"
        style={{ opacity: products.isPlaceholderData ? 0.6 : 1 }}
        contentContainerStyle={{ paddingBottom: 104 }}
        renderItem={({ item: p }) => (
          <ListItem
            title={p.name}
            // Lo que se mira primero (precio y si se ve en la tienda) va antes: si la
            // línea se corta, se pierde el SKU o la categoría, no lo importante.
            subtitle={[clp(p.priceCLP), !p.active && !p.archived ? 'Oculto' : null, p.featured ? 'Destacado' : null, p.sku, p.category].filter(Boolean).join(' · ')}
            lines={2}
            leading={
              p.image ? (
                <Image source={p.image} style={{ width: 40, height: 40, borderRadius: shape.sm }} contentFit="cover" accessibilityIgnoresInvertColors />
              ) : (
                <ProductArt korean={p.nameKorean} tone={toneFor(p.id)} size={11} style={{ width: 40, height: 40, borderRadius: shape.sm }} />
              )
            }
            trailing={
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="titleM" color={p.stock === 0 ? c.error : c.onSurface} style={{ fontVariant: ['tabular-nums'] }}>{p.stock}</Txt>
                <Txt variant="labelS" color={c.onSurfaceVariant}>en bodega</Txt>
              </View>
            }
            accessibilityLabel={`${p.name}, ${p.stock} en bodega${p.archived ? ', archivado' : ''}. Editar`}
            onPress={() => router.push({ pathname: '/vendedor/producto/[id]', params: { id: p.id } })}
          />
        )}
        ListFooterComponent={products.data && products.data.total > 0 ? <Pager page={products.data.page} totalPages={products.data.totalPages} total={products.data.total} size={size} noun={['producto', 'productos']} onGo={goTo} /> : undefined}
        ListEmptyComponent={
          products.isLoading ? (
            <View style={{ padding: 16, gap: 14 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height={44} />)}</View>
          ) : products.isError ? (
            <EmptyState icon="refresh" title="No pudimos cargar los productos" action={{ label: 'Reintentar', onPress: () => products.refetch() }} />
          ) : estado === 'archivados' ? (
            <EmptyState icon="check" title="Nada archivado" body="Los productos que archives aparecen aquí y se pueden restaurar." />
          ) : (
            <EmptyState
              icon="tag"
              title={q || categoria ? 'Sin resultados' : 'Aún no hay productos'}
              body={q || categoria ? 'Prueba con otro nombre, SKU o categoría.' : 'Crea el primero o súbelos todos de una vez con la carga masiva.'}
              action={q || categoria ? undefined : { label: 'Nuevo producto', onPress: () => router.push({ pathname: '/vendedor/producto/[id]', params: { id: 'nuevo' } }) }}
            />
          )
        }
      />
      <ExtendedFab icon="plus" label="Nuevo producto" onPress={() => router.push({ pathname: '/vendedor/producto/[id]', params: { id: 'nuevo' } })} />
    </View>
  );
}
