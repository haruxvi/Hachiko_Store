import { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, TextInput, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Chip, IconButton, Skeleton, Txt } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { EmptyState } from '@/ui/layout';
import { PageSizeChips, Pager } from '@/ui/Pager';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { ProductCard } from '@/features/catalog/ProductCard';
import { PAGE_SIZES, useCategories, useProductPage, type PageSize, type ProductQuery } from '@/lib/queries';
import type { ProductCard as Product } from '@/lib/types';
import { plural } from '@/lib/format';

const SORTS: { key: NonNullable<ProductQuery['orden']>; label: string }[] = [
  { key: 'recent', label: 'Más recientes' },
  { key: 'price-asc', label: 'Menor precio' },
  { key: 'price-desc', label: 'Mayor precio' },
];

// Buscar: escribe y los resultados aparecen solos (300 ms después de dejar de
// escribir). Filtros a la vista como chips, sin pantallas extra. Resultados por
// páginas con "Mostrar 12/24/48", igual que el catálogo web.
export default function Search() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colW = Math.floor((Math.min(width, 600) - 32 - 12) / 2);
  const params = useLocalSearchParams<{ categoria?: string }>();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<string | undefined>(params.categoria);
  const [orden, setOrden] = useState<ProductQuery['orden']>('recent');
  const [stock, setStock] = useState(false);
  const [size, setSize] = useState<PageSize>(24);
  const [page, setPage] = useState(1);
  const input = useRef<TextInputInstance>(null);
  const list = useRef<FlatList<Product>>(null);
  const categories = useCategories();

  // Si se llega desde "Explorar" con otra categoría, se aplica (ajuste en el render, sin efecto).
  const [lastParam, setLastParam] = useState(params.categoria);
  if (params.categoria !== lastParam) {
    setLastParam(params.categoria);
    setCategoria(params.categoria);
  }
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  // Cualquier cambio de búsqueda, filtro, orden o tamaño vuelve a la página 1.
  const filterKey = `${q}|${categoria ?? ''}|${orden}|${stock}|${size}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }

  const products = useProductPage({ q, categoria, orden, stock }, page, size);
  const items = products.data?.items ?? [];
  const total = products.data?.total;
  const goTo = (n: number) => {
    setPage(n);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, height: 56, borderRadius: shape.full, backgroundColor: c.surfaceContainerHigh, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 12 }}>
          <Icon name="search" size={22} color={c.onSurfaceVariant} />
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            placeholder="Buscar en Hachiko"
            placeholderTextColor={c.onSurfaceVariant}
            accessibilityLabel="Buscar productos"
            returnKeyType="search"
            autoCorrect={false}
            maxLength={100}
            selectionColor={c.primaryStrong}
            style={{ flex: 1, fontFamily: fonts.body, fontSize: 16, color: c.onSurface, height: 56 }}
          />
          {text.length > 0 && <IconButton icon="close" label="Borrar búsqueda" onPress={() => { setText(''); input.current?.focus(); }} />}
        </View>
        <ThemeToggle />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Chip label="Disponible ahora" selected={stock} onPress={() => setStock((s) => !s)} />
        {(categories.data ?? []).map((cat) => (
          <Chip key={cat.slug} label={cat.name} selected={categoria === cat.slug} onPress={() => setCategoria((v) => (v === cat.slug ? undefined : cat.slug))} />
        ))}
      </ScrollView>

      <FlatList
        ref={list}
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{ opacity: products.isPlaceholderData ? 0.6 : 1 }}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
        renderItem={({ item }) => <ProductCard product={item} width={colW} />}
        ListHeaderComponent={
          // Contador + orden + "Mostrar" en una fila deslizable, alineada con la de
          // filtros: en pantallas angostas no caben a lo ancho.
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
            <Txt variant="bodyM" color={c.onSurfaceVariant} accessibilityLiveRegion="polite">
              {total !== undefined ? plural(total, 'producto', 'productos') : ' '}
            </Txt>
            <View style={{ width: 1, height: 20, backgroundColor: c.outlineVariant, marginHorizontal: 4 }} />
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={orden === s.key} onPress={() => setOrden(s.key)} />
            ))}
            <View style={{ width: 1, height: 20, backgroundColor: c.outlineVariant, marginHorizontal: 4 }} />
            <PageSizeChips sizes={PAGE_SIZES} value={size} onChange={setSize} />
          </ScrollView>
        }
        ListFooterComponent={products.data && products.data.total > 0 ? <Pager page={products.data.page} totalPages={products.data.totalPages} total={products.data.total} size={size} noun={['producto', 'productos']} onGo={goTo} /> : undefined}
        ListEmptyComponent={
          products.isLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={colW} height={colW + 48} />)}
            </View>
          ) : products.isError ? (
            <EmptyState icon="refresh" title="No pudimos buscar" body="Revisa tu conexión y vuelve a intentarlo." action={{ label: 'Reintentar', onPress: () => products.refetch() }} />
          ) : (
            <EmptyState
              icon="search"
              title={q ? `Nada para “${q}”` : 'Sin productos aquí'}
              body={q ? 'Prueba con otra palabra o quita los filtros.' : 'Quita los filtros para ver todo el catálogo.'}
              action={categoria || stock ? { label: 'Quitar filtros', onPress: () => { setCategoria(undefined); setStock(false); } } : undefined}
            />
          )
        }
      />
    </View>
  );
}
