import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { elevation, shape } from '@/theme/tokens';
import { Card, Skeleton, Txt } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { Paper } from '@/ui/brand';
import { EmptyState, SectionHeader } from '@/ui/layout';
import { ProductCard } from '@/features/catalog/ProductCard';
import { useCategories, useMe, useMyOrders, useProducts } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { MyOrder } from '@/lib/types';

const GAP = 12;
const PAD = 16;

// Inicio: un solo momento expresivo (la cartulina con el saludo), el resto sereno.
export default function Home() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const colW = Math.floor((Math.min(width, 600) - PAD * 2 - GAP) / 2);
  const products = useProducts({ orden: 'recent' });
  const items = useMemo(() => products.data?.pages.flatMap((p) => p.items) ?? [], [products.data]);

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
      contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
      style={{ backgroundColor: c.background }}
      renderItem={({ item }) => <ProductCard product={item} width={colW} />}
      onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => products.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
      ListHeaderComponent={<Header />}
      ListEmptyComponent={
        products.isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ gap: 8 }}><Skeleton width={colW} height={colW} /><Skeleton width={colW * 0.7} height={14} /><Skeleton width={60} height={14} /></View>
            ))}
          </View>
        ) : products.isError ? (
          <EmptyState icon="refresh" title="No pudimos cargar la vitrina" body="Revisa tu conexión y vuelve a intentarlo." action={{ label: 'Reintentar', onPress: () => products.refetch() }} />
        ) : null
      }
    />
  );
}

function Header() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const me = useMe();
  const orders = useMyOrders();
  const categories = useCategories();
  const active = orders.data?.find((o) => ['PAID', 'PREPARING', 'SHIPPED'].includes(o.status));
  const name = me.data?.firstName ?? user?.firstName;

  return (
    <View>
      <Paper style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 52, borderBottomLeftRadius: shape.xl, borderBottomRightRadius: shape.xl }}>
        <Txt variant="bodyM" color={c.onPaper} style={{ opacity: 0.7, fontFamily: undefined }}>하치코</Txt>
        <Txt variant="headlineL" color={c.onPaper} accessibilityRole="header" style={{ marginTop: 2 }}>
          {name ? `Hola, ${name}` : 'Hola'}
        </Txt>
        <Txt variant="bodyL" color={c.onPaper} style={{ opacity: 0.85, marginTop: 4, maxWidth: 280 }}>
          Lo que ves es lo que hay en bodega, empacado en Recoleta.
        </Txt>
      </Paper>

      {/* Búsqueda montada sobre el borde de la cartulina */}
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Buscar productos"
        onPress={() => router.push('/buscar')}
        style={{ marginTop: -28, marginHorizontal: PAD, height: 56, borderRadius: shape.full, backgroundColor: c.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, ...elevation(2, c.shadow) }}
      >
        <Icon name="search" size={22} color={c.onSurfaceVariant} />
        <Txt variant="bodyL" color={c.onSurfaceVariant} numberOfLines={1} style={{ flex: 1 }}>Buscar ramen, mascarillas, álbumes…</Txt>
      </Pressable>

      {active && <ActiveOrder order={active} />}

      {categories.data && categories.data.length > 0 && (
        <>
          <SectionHeader title="Explorar" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: PAD, paddingBottom: 4 }}>
            {categories.data.map((cat, i) => {
              const tone = [
                [c.primaryContainer, c.onPrimaryContainer],
                [c.tertiaryContainer, c.onTertiaryContainer],
                [c.infoContainer, c.onInfoContainer],
                [c.secondaryContainer, c.onSecondaryContainer],
              ][i % 4]!;
              return (
                <Pressable
                  key={cat.slug}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoría ${cat.name}`}
                  onPress={() => router.push({ pathname: '/buscar', params: { categoria: cat.slug } })}
                  style={({ pressed }) => ({ width: 132, height: 88, borderRadius: shape.lg, backgroundColor: tone[0], padding: 14, justifyContent: 'flex-end', opacity: pressed ? 0.85 : 1 })}
                >
                  <Txt variant="titleM" color={tone[1]}>{cat.name}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <SectionHeader title="Lo nuevo en la vitrina" action={{ label: 'Ver todo', onPress: () => router.push('/buscar') }} />
    </View>
  );
}

const STEPS = ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'];

function ActiveOrder({ order }: { order: MyOrder }) {
  const { c } = useTheme();
  const pickup = order.shippingMethod === 'PICKUP';
  const step = STEPS.indexOf(order.status);
  const text = order.status === 'SHIPPED' ? (pickup ? 'está listo para retirar' : 'va en camino') : order.status === 'PREPARING' ? 'se está preparando' : 'tiene el pago confirmado';
  return (
    <Card variant="outlined" onPress={() => router.push('/pedidos')} accessibilityLabel={`Tu pedido ${order.orderNumber} ${text}. Ver mis pedidos`} style={{ marginHorizontal: PAD, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.tertiaryContainer, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={pickup ? 'store' : 'truck'} size={20} color={c.onTertiaryContainer} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="titleS">Tu pedido #{order.orderNumber} {text}</Txt>
        <Txt variant="bodyS" color={c.onSurfaceVariant}>{order.shippingLabel}</Txt>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }} accessibilityElementsHidden>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.primary : c.surfaceContainerHighest }} />
          ))}
        </View>
      </View>
      <Icon name="chevronRight" size={20} color={c.onSurfaceVariant} />
    </Card>
  );
}
