import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, IconButton, Stepper, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { ProductArt, toneFor } from '@/ui/brand';
import { EmptyState } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { FREE_SHIPPING_THRESHOLD, cartCount, cartSubtotal, checkoutUrl, returnUrl, useCart } from '@/lib/cart';
import { clp, plural } from '@/lib/format';

// Carrito. El pago se abre en el navegador seguro del teléfono con el flujo
// web que ya funciona (Webpay / Mercado Pago): la app nunca toca datos de tarjeta.
export default function CartScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lines = useCart((s) => s.lines);
  const { setQty, remove, restore } = useCart.getState();
  const [paying, setPaying] = useState(false);
  const subtotal = cartSubtotal(lines);
  const missing = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const pay = async () => {
    setPaying(true);
    try {
      const r = await WebBrowser.openAuthSessionAsync(checkoutUrl(lines), returnUrl());
      if (r.type === 'success' && r.url.includes('pedido-confirmado')) {
        const n = /[?&]n=(\d+)/.exec(r.url)?.[1];
        router.push({ pathname: '/pedido-confirmado', params: n ? { n } : {} });
      }
    } finally {
      setPaying(false);
    }
  };

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, justifyContent: 'center' }}>
        <EmptyState icon="bag" title="Tu carrito está vacío" body="Agrega algo rico de la vitrina y aparecerá aquí." action={{ label: 'Ir a la vitrina', onPress: () => router.navigate('/') }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 200, gap: 12 }}>
        <Txt variant="headlineM" accessibilityRole="header">Tu carrito</Txt>
        <Txt variant="bodyM" color={c.onSurfaceVariant} style={{ marginTop: -8, marginBottom: 4 }}>{plural(cartCount(lines), 'producto', 'productos')}</Txt>

        {lines.map((l) => (
          <Animated.View key={l.slug} layout={LinearTransition.springify().damping(18)} exiting={FadeOut.duration(160)}>
            <Card variant="outlined" style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: shape.md, overflow: 'hidden' }}>
                {l.image ? <Image source={l.image} style={{ flex: 1 }} contentFit="cover" /> : <ProductArt korean={l.nameKorean} tone={toneFor(l.slug)} style={{ flex: 1 }} size={18} />}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                  <Txt variant="titleS" numberOfLines={2} style={{ flex: 1 }}>{l.name}</Txt>
                  <IconButton
                    icon="trash"
                    label={`Quitar ${l.name}`}
                    size={36}
                    onPress={() => {
                      const removed = remove(l.slug);
                      tap();
                      if (removed) snack(`Quitaste ${removed.name}`, { label: 'Deshacer', onPress: () => restore(removed) });
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Stepper value={l.qty} max={l.max} onChange={(n) => setQty(l.slug, n)} label={`Cantidad de ${l.name}`} />
                  <Txt variant="titleM" style={{ fontVariant: ['tabular-nums'] }}>{clp(l.priceCLP * l.qty)}</Txt>
                </View>
              </View>
            </Card>
          </Animated.View>
        ))}

        {/* Envío gratis: cuánto falta, con barra de avance */}
        <Card variant="filled" style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="truck" size={20} color={c.onSurfaceVariant} />
            <Txt variant="bodyM" style={{ flex: 1 }}>
              {missing > 0 ? `Te faltan ${clp(missing)} para el envío gratis` : 'Tu pedido tiene envío gratis'}
            </Txt>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceContainerLowest, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`, height: '100%', backgroundColor: c.primary, borderRadius: 3 }} />
          </View>
        </Card>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="bodyL" color={c.onSurfaceVariant}>Subtotal</Txt>
          <Txt variant="titleL" style={{ fontVariant: ['tabular-nums'] }}>{clp(subtotal)}</Txt>
        </View>
        <Button label="Pagar de forma segura" icon="lock" size="lg" block loading={paying} onPress={pay} accessibilityHint="Se abre el pago en el navegador seguro del teléfono" />
        <Txt variant="bodyS" color={c.onSurfaceVariant} style={{ textAlign: 'center' }}>El despacho y el pago se completan con Webpay o Mercado Pago.</Txt>
      </View>
    </View>
  );
}
