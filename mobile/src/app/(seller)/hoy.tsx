import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, shape } from '@/theme/tokens';
import { Card, Divider, LeadIcon, ListItem, Skeleton, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { Paper } from '@/ui/brand';
import { EmptyState, SectionHeader } from '@/ui/layout';
import { useSellerToday } from '@/lib/queries';
import { clp, plural, relative, todayTitle } from '@/lib/format';

// "Hoy": lo primero que ve el vendedor. Lo urgente arriba (avisos, lo que hay
// que empacar, lo que se está acabando) y el escáner siempre a mano.
export default function Today() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useSellerToday();
  const d = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 112 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
      >
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="store" size={22} color={c.onSurfaceVariant} />
          <Txt variant="labelL" color={c.onSurfaceVariant}>Trastienda</Txt>
        </View>
        <Txt variant="headlineL" accessibilityRole="header" style={{ paddingHorizontal: 16, marginTop: 12 }}>{todayTitle()}</Txt>

        {q.isError && !d ? (
          <EmptyState icon="refresh" title="No pudimos cargar el día" body="Revisa tu conexión." action={{ label: 'Reintentar', onPress: () => q.refetch() }} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 20 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${d?.kpis.toPack ?? 0} pedidos por empacar`} onPress={() => router.navigate('/despacho')} style={{ flex: 1 }}>
                <Paper radius={shape.lg} style={{ padding: 16, minHeight: 128 }}>
                  <Txt variant="labelL" color={c.onPaper}>Por empacar</Txt>
                  {d ? <Txt variant="displayS" color={c.onPaper} style={{ marginTop: 8, fontVariant: ['tabular-nums'] }}>{d.kpis.toPack}</Txt> : <Skeleton width={48} height={40} style={{ marginTop: 8 }} />}
                  {d && <Txt variant="bodyS" color={c.onPaper} style={{ opacity: 0.8 }}>{d.kpis.preparing ? `${d.kpis.preparing} en preparación` : 'Nada en preparación'}</Txt>}
                </Paper>
              </Pressable>
              <Card variant="filled" style={{ flex: 1, minHeight: 128 }}>
                <Txt variant="labelL" color={c.onSurfaceVariant}>Ventas de hoy</Txt>
                {d ? <Txt variant="headlineS" style={{ marginTop: 16, fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>{clp(d.kpis.salesToday)}</Txt> : <Skeleton width={110} height={28} style={{ marginTop: 16 }} />}
                {d && <Txt variant="bodyS" color={c.onSurfaceVariant} numberOfLines={1}>{plural(d.kpis.ordersToday, 'pedido', 'pedidos')}</Txt>}
              </Card>
            </View>

            {d && d.alerts.length > 0 && (
              <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 8 }}>
                {d.alerts.slice(0, 3).map((a, i) => {
                  const tone = a.level === 'critical' ? [c.errorContainer, c.onErrorContainer] : a.level === 'warning' ? [c.primaryContainer, c.onPrimaryContainer] : [c.surfaceContainerHigh, c.onSurfaceVariant];
                  return (
                    <View key={i} accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: shape.md, backgroundColor: tone[0] }}>
                      <Icon name={a.level === 'info' ? 'info' : 'alert'} size={18} color={tone[1]!} />
                      <Txt variant="bodyM" color={tone[1]} style={{ flex: 1 }}>{a.message}</Txt>
                    </View>
                  );
                })}
              </View>
            )}

            <SectionHeader title="Para empacar" action={{ label: 'Ver todos', onPress: () => router.navigate('/despacho') }} />
            <View style={{ paddingHorizontal: 16 }}>
              <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
                {!d ? (
                  <View style={{ padding: 16, gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={44} />)}</View>
                ) : d.toPack.length === 0 ? (
                  <View style={{ padding: 20, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <LeadIcon icon="check" tone="tertiary" />
                    <Txt variant="bodyL" style={{ flex: 1 }}>Todo despachado. Nada pendiente por ahora.</Txt>
                  </View>
                ) : (
                  d.toPack.map((o, i) => (
                    <View key={o.id}>
                      {i > 0 && <Divider inset />}
                      <ListItem
                        title={`#${o.orderNumber}${o.flagged ? ' · Revisar' : ''}`}
                        subtitle={`${o.isPickup ? 'Retiro en tienda' : o.commune ?? 'Despacho'} · ${plural(o.itemCount, 'producto', 'productos')} · ${relative(o.createdAt)}`}
                        leading={<LeadIcon icon={o.flagged ? 'alert' : o.isPickup ? 'store' : 'package'} tone={o.flagged ? 'error' : o.isPickup ? 'tertiary' : 'primary'} />}
                        trailing={<Txt variant="titleS" style={{ fontVariant: ['tabular-nums'] }}>{clp(o.totalCLP)}</Txt>}
                        onPress={() => router.push({ pathname: '/vendedor/pedido/[id]', params: { id: o.id } })}
                      />
                    </View>
                  ))
                )}
              </Card>
            </View>

            {d && d.lowStock.length > 0 && (
              <>
                <SectionHeader title="Se está acabando" action={{ label: 'Inventario', onPress: () => router.navigate('/inventario') }} />
                <View style={{ paddingHorizontal: 16 }}>
                  <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
                    {d.lowStock.map((p, i) => (
                      <View key={p.id}>
                        {i > 0 && <Divider />}
                        <ListItem title={p.name} trailing={<Txt variant="titleS" color={p.stock === 0 ? c.error : c.onPrimaryContainer}>{p.stock === 0 ? 'Sin stock' : `${p.stock} uds.`}</Txt>} />
                      </View>
                    ))}
                  </Card>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB extendido: escanear un producto */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escanear un producto"
        onPress={() => { tap(); router.push('/vendedor/escanear'); }}
        style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: 16, height: 56, paddingHorizontal: 20, borderRadius: shape.lg, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ scale: pressed ? 0.96 : 1 }], ...elevation(3, c.shadow) })}
      >
        <Icon name="scan" size={22} color={c.onPrimary} />
        <Txt variant="labelL" color={c.onPrimary}>Escanear</Txt>
      </Pressable>
    </View>
  );
}
