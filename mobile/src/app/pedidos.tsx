import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Skeleton, Txt } from '@/ui/core';
import { EmptyState, TopBar } from '@/ui/layout';
import { useMyOrders } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { clp, shortDate } from '@/lib/format';
import type { MyOrder, OrderStatus } from '@/lib/types';

const ORDER: OrderStatus[] = ['PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'];
const reached = (cur: OrderStatus, step: OrderStatus) => ORDER.indexOf(cur) >= ORDER.indexOf(step);

export default function MyOrders() {
  const { c } = useTheme();
  const authed = useSession((s) => s.status === 'authed');
  const q = useMyOrders();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title="Mis pedidos" />
      {!authed ? (
        <EmptyState icon="user" title="Inicia sesión" body="Para ver tus pedidos y en qué van." action={{ label: 'Iniciar sesión', onPress: () => router.push('/login') }} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListEmptyComponent={
            q.isLoading ? (
              <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={150} radius={shape.lg} />)}</View>
            ) : q.isError ? (
              <EmptyState icon="refresh" title="No pudimos cargar tus pedidos" action={{ label: 'Reintentar', onPress: () => q.refetch() }} />
            ) : (
              <EmptyState icon="package" title="Aún no tienes pedidos" body="Cuando compres, aquí verás en qué va cada uno." action={{ label: 'Ir a la vitrina', onPress: () => router.navigate('/') }} />
            )
          }
        />
      )}
    </View>
  );
}

function OrderCard({ order: o }: { order: MyOrder }) {
  const { c } = useTheme();
  const pickup = o.shippingMethod === 'PICKUP';
  const cancelled = o.status === 'CANCELLED';
  const steps: [OrderStatus, string][] = [
    ['PAID', 'Pagado'],
    ['SHIPPED', pickup ? 'Listo para retiro' : 'Despachado'],
    ['DELIVERED', pickup ? 'Retirado' : 'Entregado'],
  ];
  const label = cancelled ? 'Cancelado' : o.status === 'PENDING' ? 'Pago pendiente' : steps.filter(([s]) => reached(o.status, s)).at(-1)?.[1] ?? 'Pagado';
  const items = o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');

  return (
    <Card variant="outlined" style={{ gap: 12 }} accessibilityLabel={`Pedido ${o.orderNumber}, ${label}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Txt variant="titleM">Pedido #{o.orderNumber}</Txt>
        <Txt variant="bodyS" color={c.onSurfaceVariant}>{shortDate(o.createdAt)}</Txt>
      </View>
      <Txt variant="bodyM" color={c.onSurfaceVariant} numberOfLines={2}>{items}</Txt>
      {!cancelled && (
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityElementsHidden>
          {steps.map(([s, l]) => {
            const done = reached(o.status, s);
            return (
              <View key={s} style={{ flex: 1, gap: 6 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: done ? c.primary : c.surfaceContainerHighest }} />
                <Txt variant="labelS" color={done ? c.onSurface : c.onSurfaceVariant} numberOfLines={1}>{l}</Txt>
              </View>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ height: 28, paddingHorizontal: 10, borderRadius: shape.sm, justifyContent: 'center', backgroundColor: cancelled ? c.errorContainer : o.status === 'DELIVERED' ? c.tertiaryContainer : c.secondaryContainer }}>
          <Txt variant="labelM" color={cancelled ? c.onErrorContainer : o.status === 'DELIVERED' ? c.onTertiaryContainer : c.onSecondaryContainer}>{label}</Txt>
        </View>
        <Txt variant="titleM" style={{ fontVariant: ['tabular-nums'] }}>{clp(o.totalCLP)}</Txt>
      </View>
      {o.trackingUrl && o.status === 'SHIPPED' && (
        <Button variant="tonal" icon="truck" label={`Seguir envío en ${o.shippingLabel}`} onPress={() => WebBrowser.openBrowserAsync(o.trackingUrl!)} />
      )}
    </Card>
  );
}
