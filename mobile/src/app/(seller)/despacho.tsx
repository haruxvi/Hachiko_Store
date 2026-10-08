import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Divider, IconButton, LeadIcon, ListItem, Skeleton, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { EmptyState } from '@/ui/layout';
import { useSellerOrders } from '@/lib/queries';
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
  const orders = useSellerOrders(tab, q);
  const items = useMemo(() => orders.data?.pages.flatMap((p) => p.items) ?? [], [orders.data]);
  const counts = orders.data?.pages[0]?.counts;

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <Txt variant="headlineM" accessibilityRole="header" style={{ paddingHorizontal: 16, paddingTop: 12 }}>Pedidos</Txt>

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

      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        ItemSeparatorComponent={() => <Divider inset />}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
        onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && orders.fetchNextPage()}
        contentContainerStyle={{ paddingBottom: 24 }}
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
