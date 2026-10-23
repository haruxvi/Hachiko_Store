import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Chip, Divider, IconButton, ListItem, Skeleton, Txt } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { EmptyState } from '@/ui/layout';
import { PageSizeChips, Pager } from '@/ui/Pager';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { LIST_PAGE_SIZES, useInventory, type ListPageSize } from '@/lib/queries';
import type { InventoryRow } from '@/lib/types';

// Inventario: buscar por nombre o SKU, ver solo lo que está bajo el umbral, y
// tocar un producto para ajustar su stock (o escanearlo).
export default function InventoryScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [low, setLow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const [size, setSize] = useState<ListPageSize>(20);
  const [page, setPage] = useState(1);
  const list = useRef<FlatList<InventoryRow>>(null);
  // Cambiar búsqueda, filtro o tamaño vuelve a la página 1.
  const filterKey = `${q}|${low}|${size}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const inv = useInventory(q, low, page, size);
  const items = inv.data?.items ?? [];
  const lowCount = inv.data?.lowCount;
  const goTo = (n: number) => {
    setPage(n);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
        <Txt variant="headlineM" accessibilityRole="header" style={{ flex: 1 }}>Inventario</Txt>
        <IconButton icon="scan" label="Escanear un producto" variant="tonal" onPress={() => router.push('/vendedor/escanear')} />
        <ThemeToggle />
      </View>

      <View style={{ marginHorizontal: 16, marginTop: 12, height: 48, borderRadius: shape.full, backgroundColor: c.surfaceContainerHigh, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 10 }}>
        <Icon name="search" size={20} color={c.onSurfaceVariant} />
        <TextInput value={text} onChangeText={setText} placeholder="Nombre o SKU" placeholderTextColor={c.onSurfaceVariant} accessibilityLabel="Buscar producto" autoCapitalize="none" maxLength={100} style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.onSurface, height: 48 }} />
        {text.length > 0 && <IconButton icon="close" label="Borrar búsqueda" size={40} onPress={() => setText('')} />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Chip label={lowCount !== undefined ? `Bajo el umbral · ${lowCount}` : 'Bajo el umbral'} selected={low} onPress={() => setLow((v) => !v)} />
        <View style={{ width: 1, height: 20, backgroundColor: c.outlineVariant, marginHorizontal: 4 }} />
        <PageSizeChips sizes={LIST_PAGE_SIZES} value={size} onChange={setSize} />
      </ScrollView>

      <FlatList
        ref={list}
        data={items}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={() => <Divider />}
        refreshControl={<RefreshControl refreshing={inv.isRefetching} onRefresh={() => void inv.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
        style={{ opacity: inv.isPlaceholderData ? 0.6 : 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListFooterComponent={inv.data && inv.data.total > 0 ? <Pager page={inv.data.page} totalPages={inv.data.totalPages} total={inv.data.total} size={size} noun={['producto', 'productos']} onGo={goTo} /> : undefined}
        renderItem={({ item: p }) => (
          <ListItem
            title={p.name}
            subtitle={`${p.sku} · ${p.category}${p.reserved ? ` · ${p.reserved} en carritos` : ''}`}
            accessibilityLabel={`${p.name}, ${p.available} disponibles${p.isLow ? ', bajo el umbral' : ''}. Ajustar stock`}
            trailing={
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="titleM" color={p.available === 0 ? c.error : p.isLow ? c.onPrimaryContainer : c.onSurface} style={{ fontVariant: ['tabular-nums'] }}>{p.available}</Txt>
                <Txt variant="labelS" color={c.onSurfaceVariant}>{p.isLow ? `umbral ${p.threshold}` : 'disponibles'}</Txt>
              </View>
            }
            onPress={() => router.push({ pathname: '/vendedor/stock/[sku]', params: { sku: p.sku } })}
          />
        )}
        ListEmptyComponent={
          inv.isLoading ? (
            <View style={{ padding: 16, gap: 14 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height={44} />)}</View>
          ) : inv.isError ? (
            <EmptyState icon="refresh" title="No pudimos cargar el inventario" action={{ label: 'Reintentar', onPress: () => inv.refetch() }} />
          ) : (
            <EmptyState icon={low ? 'check' : 'search'} title={low ? 'Nada bajo el umbral' : 'Sin resultados'} body={low ? 'El stock está al día.' : 'Busca por nombre o SKU.'} />
          )
        }
      />
    </View>
  );
}
