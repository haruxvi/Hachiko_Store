import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Chip, IconButton, Skeleton, Txt } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { EmptyState } from '@/ui/layout';
import { ProductCard } from '@/features/catalog/ProductCard';
import { useCategories, useProducts, type ProductQuery } from '@/lib/queries';
import { plural } from '@/lib/format';

const SORTS: { key: NonNullable<ProductQuery['orden']>; label: string }[] = [
  { key: 'recent', label: 'Más recientes' },
  { key: 'price-asc', label: 'Menor precio' },
  { key: 'price-desc', label: 'Mayor precio' },
];

// Buscar: escribe y los resultados aparecen solos (300 ms después de dejar de
// escribir). Filtros a la vista como chips, sin pantallas extra.
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
  const input = useRef<TextInput>(null);
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

  const products = useProducts({ q, categoria, orden, stock });
  const items = useMemo(() => products.data?.pages.flatMap((p) => p.items) ?? [], [products.data]);
  const total = products.data?.pages[0]?.total;

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ height: 56, borderRadius: shape.full, backgroundColor: c.surfaceContainerHigh, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 12 }}>
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
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Chip label="Disponible ahora" selected={stock} onPress={() => setStock((s) => !s)} />
        {(categories.data ?? []).map((cat) => (
          <Chip key={cat.slug} label={cat.name} selected={categoria === cat.slug} onPress={() => setCategoria((v) => (v === cat.slug ? undefined : cat.slug))} />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
        renderItem={({ item }) => <ProductCard product={item} width={colW} />}
        onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <Txt variant="bodyM" color={c.onSurfaceVariant} accessibilityLiveRegion="polite">
              {total !== undefined ? plural(total, 'producto', 'productos') : ' '}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {SORTS.map((s) => (
                <Chip key={s.key} label={s.label} selected={orden === s.key} onPress={() => setOrden(s.key)} />
              ))}
            </View>
          </View>
        }
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
