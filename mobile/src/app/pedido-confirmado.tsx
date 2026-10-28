import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Txt, tap } from '@/ui/core';
import { Paper, Stamp } from '@/ui/brand';
import { useCart } from '@/lib/cart';

// Vuelta del pago (hachiko://pedido-confirmado?n=1042). Único momento
// expresivo: el carnet con el timbre "PAGO RECIBIDO".
export default function OrderConfirmed() {
  const { n } = useLocalSearchParams<{ n?: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  useEffect(() => {
    useCart.getState().clear();
    tap('success');
    void qc.invalidateQueries({ queryKey: ['my-orders'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 32, paddingHorizontal: 20, paddingBottom: insets.bottom + 20, justifyContent: 'space-between' }}>
      <Paper radius={shape.xl} style={{ padding: 24, minHeight: 280 }}>
        <Txt variant="bodyM" color={c.onPaper} style={{ opacity: 0.75 }}>주문 완료</Txt>
        <Txt variant="headlineL" color={c.onPaper} accessibilityRole="header" style={{ marginTop: 56, maxWidth: 220 }}>¡Pedido confirmado!</Txt>
        {n && <Txt variant="titleM" color={c.onPaper} style={{ marginTop: 8, opacity: 0.85 }}>Pedido #{n}</Txt>}
        <Txt variant="bodyM" color={c.onPaper} style={{ marginTop: 8, opacity: 0.85, maxWidth: 260 }}>Te mandamos el detalle por correo. Te avisamos cuando salga.</Txt>
        <View style={{ position: 'absolute', right: 8, top: 16 }}>
          <Stamp />
        </View>
      </Paper>
      <View style={{ gap: 12 }}>
        <Button label="Ver mis pedidos" size="lg" block onPress={() => router.replace('/pedidos')} />
        <Button label="Seguir comprando" variant="text" block onPress={() => router.replace('/')} style={{ alignSelf: 'center' }} />
      </View>
    </View>
  );
}
