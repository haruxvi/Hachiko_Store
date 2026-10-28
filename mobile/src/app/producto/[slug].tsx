import { useState } from 'react';
import { ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, IconButton, Skeleton, Stepper, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { ProductArt, toneFor } from '@/ui/brand';
import { EmptyState } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { ProductCard } from '@/features/catalog/ProductCard';
import { useProduct } from '@/lib/queries';
import { useCart } from '@/lib/cart';
import { clp } from '@/lib/format';

// Detalle: foto a sangre, hoja que sube sobre ella y compra fija abajo.
export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const q = useProduct(slug);
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const p = q.data;
  const heroH = Math.min(380, width * 0.92);

  if (q.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, justifyContent: 'center' }}>
        <EmptyState icon="package" title="No encontramos ese producto" body="Puede que ya no esté a la venta." action={{ label: 'Volver a la tienda', onPress: () => router.replace('/') }} />
      </View>
    );
  }

  const out = p?.stockState === 'out';
  const addToCart = () => {
    if (!p) return;
    tap('success');
    add({ slug: p.slug, name: p.name, nameKorean: p.nameKorean, priceCLP: p.priceCLP, image: p.image, max: p.maxQuantity }, qty);
    snack(`${qty} × ${p.name} en tu carrito`, { label: 'Ver carrito', onPress: () => router.push('/carrito') });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ height: heroH }}>
          {p?.image ? (
            <Image source={p.image} style={{ flex: 1 }} contentFit="cover" transition={250} accessibilityLabel={p.name} />
          ) : (
            <ProductArt korean={p?.nameKorean ?? null} tone={toneFor(slug)} style={{ flex: 1 }} size={88} />
          )}
        </View>

        <Animated.View entering={FadeInUp.duration(320)} style={{ marginTop: -32, borderTopLeftRadius: shape.xl, borderTopRightRadius: shape.xl, backgroundColor: c.background, paddingHorizontal: 20, paddingTop: 12 }}>
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: c.outline, opacity: 0.5, alignSelf: 'center', marginBottom: 16 }} />
          {!p ? (
            <View style={{ gap: 10 }}><Skeleton width={120} height={14} /><Skeleton width="80%" height={28} /><Skeleton width={90} height={24} /><Skeleton width="100%" height={60} /></View>
          ) : (
            <>
              <Txt variant="labelM" color={c.onSurfaceVariant}>{p.category?.name ?? 'Hachiko'}{p.nameKorean ? ` · ${p.nameKorean}` : ''}</Txt>
              <Txt variant="headlineS" accessibilityRole="header" style={{ marginTop: 4 }}>{p.name}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <Txt variant="titleL" style={{ fontVariant: ['tabular-nums'] }}>{clp(p.priceCLP)}</Txt>
                <View style={{ height: 28, paddingHorizontal: 10, borderRadius: shape.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: out ? c.inverseSurface : p.stockState === 'low' ? c.errorContainer : c.tertiaryContainer }}>
                  <Icon name={out ? 'close' : 'check'} size={14} color={out ? c.inverseOnSurface : p.stockState === 'low' ? c.onErrorContainer : c.onTertiaryContainer} />
                  <Txt variant="labelM" color={out ? c.inverseOnSurface : p.stockState === 'low' ? c.onErrorContainer : c.onTertiaryContainer}>
                    {out ? 'Agotado' : p.stockState === 'low' ? `Quedan ${p.left}` : 'Disponible'}
                  </Txt>
                </View>
              </View>
              <Txt variant="bodyL" color={c.onSurfaceVariant} style={{ marginTop: 14 }}>{p.description}</Txt>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
                <Txt variant="bodyS" color={c.onSurfaceVariant}>Peso {p.weightGrams} g</Txt>
                <Txt variant="bodyS" color={c.onSurfaceVariant}>Envío gratis desde $50.000</Txt>
              </View>

              {p.together.length > 0 && (
                <>
                  <Txt variant="titleM" style={{ marginTop: 28, marginBottom: 12 }}>Se compran juntos</Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }} style={{ marginHorizontal: -20 }} contentInset={{ left: 20 }}>
                    <View style={{ width: 8 }} />
                    {p.together.map((t) => <ProductCard key={t.id} product={t} width={128} />)}
                    <View style={{ width: 8 }} />
                  </ScrollView>
                </>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* Atrás / compartir flotando sobre la foto */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }} pointerEvents="box-none">
        <IconButton icon="back" label="Volver" variant="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {p && <IconButton icon="share" label="Compartir" variant="glass" onPress={() => Share.share({ message: `${p.name} en Hachiko: ${p.webUrl}` })} />}
      </View>

      {/* Compra fija abajo */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {!out && p && <Stepper value={qty} max={Math.max(1, p.maxQuantity)} onChange={setQty} label="Cantidad" />}
        <Button
          label={!p ? 'Cargando…' : out ? 'Agotado' : `Agregar · ${clp(p.priceCLP * qty)}`}
          size="lg"
          disabled={!p || out}
          onPress={addToCart}
          style={{ flex: 1 }}
          block
        />
      </View>
    </View>
  );
}
