import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { IconButton, Txt, tap } from '@/ui/core';
import { ProductArt, toneFor } from '@/ui/brand';
import { snack } from '@/ui/Snackbar';
import { clp } from '@/lib/format';
import { useCart } from '@/lib/cart';
import type { ProductCard as Product } from '@/lib/types';

// Tarjeta de la vitrina: foto 1:1 (o cartón con el nombre en coreano), nombre,
// precio y "+" rápido. "Quedan N" cuando el stock está bajo; "Agotado" si no hay.
export const ProductCard = memo(function ProductCard({ product, width }: { product: Product; width: number }) {
  const { c } = useTheme();
  const add = useCart((s) => s.add);
  const out = product.stockState === 'out';

  const quickAdd = () => {
    tap('success');
    add({ slug: product.slug, name: product.name, nameKorean: product.nameKorean, priceCLP: product.priceCLP, image: product.image, max: product.left ?? 10 });
    snack(`${product.name} se agregó al carrito`, { label: 'Ver carrito', onPress: () => router.push('/carrito') });
  };

  // La tarjeta y el "+" son hermanos (no un botón dentro de otro): así cada uno
  // es un destino táctil y de lector de pantalla independiente.
  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${clp(product.priceCLP)}${out ? ', agotado' : product.stockState === 'low' ? `, quedan ${product.left}` : ''}`}
        onPress={() => router.push({ pathname: '/producto/[slug]', params: { slug: product.slug } })}
        style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.88 : 1 })}
      >
        <View style={{ width, height: width, borderRadius: shape.md, overflow: 'hidden' }}>
          {product.image ? (
            <Image source={product.image} style={{ flex: 1 }} contentFit="cover" transition={200} recyclingKey={product.id} />
          ) : (
            <ProductArt korean={product.nameKorean} tone={toneFor(product.slug)} style={{ flex: 1 }} />
          )}
          {product.stockState !== 'ok' && (
            <View style={{ position: 'absolute', top: 8, left: 8, height: 24, paddingHorizontal: 8, borderRadius: shape.sm, justifyContent: 'center', backgroundColor: out ? c.inverseSurface : c.errorContainer }}>
              <Txt variant="labelM" color={out ? c.inverseOnSurface : c.onErrorContainer}>{out ? 'Agotado' : `Quedan ${product.left}`}</Txt>
            </View>
          )}
        </View>
        <Txt variant="titleS" numberOfLines={2}>{product.name}</Txt>
        <Txt variant="titleM" style={{ fontVariant: ['tabular-nums'], marginTop: -4 }} color={out ? c.onSurfaceVariant : c.onSurface}>{clp(product.priceCLP)}</Txt>
      </Pressable>
      {!out && (
        <IconButton icon="plus" label={`Agregar ${product.name} al carrito`} variant="filled" size={40} onPress={quickAdd} style={{ position: 'absolute', top: width - 48, right: 8 }} />
      )}
    </View>
  );
});
