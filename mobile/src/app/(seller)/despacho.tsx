import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Divider, IconButton, LeadIcon, ListItem, Skeleton, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { EmptyState } from '@/ui/layout';
import { PageSizeChips, Pager } from '@/ui/Pager';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { LIST_PAGE_SIZES, useSellerOrders, type ListPageSize } from '@/lib/queries';
import type { SellerOrderRow } from '@/lib/types';
import { clp, plural, relative } from '@/lib/format';

// Pedidos por despachar: pestañas "Por empacar" (lo más antiguo primero) y
// "Enviadas", con búsqueda por número, cliente, comuna o producto.
export default function Dispatch() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'empacar' | 'enviadas'>('empacar');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const [size, setSize] = useState<ListPageSize>(20);
  const [page, setPage] = useState(1);
  const list = useRef<FlatList<SellerOrderRow>>(null);
  // Cambiar de pestaña, búsqueda o tamaño vuelve a la página 1.
  const filterKey = `${tab}|${q}|${size}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const orders = useSellerOrders(tab, q, page, size);
  const items = orders.data?.items ?? [];
  const counts = orders.data?.counts;
  const goTo = (n: number) => {
    setPage(n);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 }}>
        <Txt variant="headlineM" accessibilityRole="header">Pedidos</Txt>
        <ThemeToggle />
      </View>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 8, borderBottomWidth: 1, borderBottomColor: c.outlineVariant }}>
        {([['empacar', 'Por empacar', counts?.empacar], ['enviadas', 'Enviadas', counts?.enviadas]] as const).map(([k, label, n]) => {
          const on = tab === k;
          return (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(); setTab(k); }} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="labelL" color={on ? c.onPrimaryContainer : c.onSurfaceVariant}>{label}{n !== undefined ? ` · ${n}` : ''}</Txt>
              {on && <View style={{ position: 'absolute', bottom: 0, width: 56, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: c.primary }} />}
            </Pressable>
          );
        })}
      </View>

      <View style={{ margin: 16, height: 48, borderRadius: shape.full, backgroundColor: c.surfaceContainerHigh, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 10 }}>
        <Icon name="search" size={20} color={c.onSurfaceVariant} />
        <TextInput value={text} onChangeText={setText} placeholder="Número, cliente, comuna o producto" placeholderTextColor={c.onSurfaceVariant} accessibilityLabel="Buscar pedido" maxLength={100} style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.onSurface, height: 48 }} />
        {text.length > 0 && <IconButton icon="close" label="Borrar búsqueda" size={40} onPress={() => setText('')} />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <PageSizeChips sizes={LIST_PAGE_SIZES} value={size} onChange={setSize} />
      </ScrollView>

      <FlatList
        ref={list}
        data={items}
        keyExtractor={(o) => o.id}
        ItemSeparatorComponent={() => <Divider inset />}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
        style={{ opacity: orders.isPlaceholderData ? 0.6 : 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListFooterComponent={orders.data && orders.data.total > 0 ? <Pager page={orders.data.page} totalPages={orders.data.totalPages} total={orders.data.total} size={size} noun={['pedido', 'pedidos']} onGo={goTo} /> : undefined}
        renderItem={({ item: o }) => (
          <ListItem
            title={`#${o.orderNumber} · ${o.recipientName}`}
            subtitle={`${o.isPickup ? 'Retiro en tienda' : `${o.shippingLabel}${o.commune ? ` · ${o.commune}` : ''}`} · ${plural(o.itemCount, 'producto', 'productos')} · ${relative(o.createdAt)}`}
            lines={2}
            leading={<LeadIcon icon={o.flagged ? 'alert' : o.isPickup ? 'store' : o.status === 'SHIPPED' ? 'truck' : 'package'} tone={o.flagged ? 'error' : o.status === 'SHIPPED' ? 'secondary' : o.isPickup ? 'tertiary' : 'primary'} />}
            trailing={<Txt variant="titleS" style={{ fontVariant: ['tabular-nums'] }}>{clp(o.totalCLP)}</Txt>}
            onPress={() => router.push({ pathname: '/vendedor/pedido/[id]', params: { id: o.id } })}
          />
        )}
        ListEmptyComponent={
          orders.isLoading ? (
            <View style={{ padding: 16, gap: 14 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={52} />)}</View>
          ) : orders.isError ? (
            <EmptyState icon="refresh" title="No pudimos cargar los pedidos" action={{ label: 'Reintentar', onPress: () => orders.refetch() }} />
          ) : q ? (
            <EmptyState icon="search" title={`Nada para “${q}”`} body="Busca por número, nombre del cliente, comuna o producto." />
          ) : tab === 'empacar' ? (
            <EmptyState icon="check" title="Todo despachado" body="Cuando entre un pedido pagado aparecerá aquí." />
          ) : (
            <EmptyState icon="truck" title="Sin envíos en curso" />
          )
        }
      />
    </View>
  );
}
