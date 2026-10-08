import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Divider, IconButton, Skeleton, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { TextField } from '@/ui/TextField';
import { EmptyState, TopBar } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { useSellerOrder } from '@/lib/queries';
import { api, ApiError } from '@/lib/api';
import { clp, shortDate } from '@/lib/format';

// Ficha de despacho: solo lo necesario para empacar y etiquetar (Ley 21.719).
export default function SellerOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useSellerOrder(id);
  const o = q.data;
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmShip = () => {
    if (!o) return;
    const title = o.isPickup ? '¿Listo para retiro?' : '¿Marcar como enviado?';
    const body = o.isPickup ? 'Le avisaremos al cliente por correo que puede pasar a buscarlo.' : `Le enviaremos al cliente el seguimiento${tracking ? ` ${tracking}` : ''} por correo.`;
    const go = () => void ship();
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n${body}`)) go();
      return;
    }
    Alert.alert(title, body, [{ text: 'Volver', style: 'cancel' }, { text: o.isPickup ? 'Sí, está listo' : 'Sí, enviar', onPress: go }]);
  };

  const ship = async () => {
    setBusy(true);
    try {
      await api(`/seller/orders/${encodeURIComponent(id)}/ship`, { method: 'POST', body: tracking.trim() ? { trackingNumber: tracking.trim() } : {} });
      tap('success');
      snack(o?.isPickup ? `#${o.orderNumber} quedó listo para retiro` : `#${o?.orderNumber} quedó como enviado`);
      void qc.invalidateQueries({ queryKey: ['seller'] });
      router.back();
    } catch (e) {
      tap('warning');
      snack(e instanceof ApiError ? e.message : 'No se pudo actualizar el pedido.');
    } finally {
      setBusy(false);
    }
  };

  if (q.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <TopBar title="Pedido" />
        <EmptyState icon="package" title="No encontramos ese pedido" action={{ label: 'Volver', onPress: () => router.back() }} />
      </View>
    );
  }

  const address = o ? [[o.shippingStreet, o.shippingNumber].filter(Boolean).join(' '), o.shippingApartment].filter(Boolean).join(', ') : '';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={o ? `Pedido #${o.orderNumber}` : 'Pedido'} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: o?.canShip ? 180 + insets.bottom : 32 }}>
        {!o ? (
          <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={110} radius={shape.lg} />)}</View>
        ) : (
          <>
            {o.risk && (
              <Card variant="filled" style={{ backgroundColor: c.errorContainer, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Icon name="alert" size={20} color={c.onErrorContainer} />
                  <Txt variant="titleS" color={c.onErrorContainer}>Revisar antes de despachar</Txt>
                </View>
                {o.risk.reasons.map((r) => <Txt key={r} variant="bodyM" color={c.onErrorContainer}>· {r}</Txt>)}
                <Txt variant="bodyS" color={c.onErrorContainer}>El modelo solo sugiere revisar; la decisión es tuya.</Txt>
              </Card>
            )}

            <Card variant="outlined" style={{ gap: 12 }}>
              <Txt variant="labelM" color={c.onSurfaceVariant}>{o.isPickup ? 'Retira' : 'Despachar a'}</Txt>
              <Txt variant="headlineS">{o.recipientName}</Txt>
              {!o.isPickup && (
                <View style={{ gap: 2 }}>
                  <Txt variant="bodyL" selectable>{address}</Txt>
                  <Txt variant="bodyM" color={c.onSurfaceVariant}>{[o.shippingCommune, o.shippingRegion].filter(Boolean).join(' · ')}</Txt>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt variant="bodyL" style={{ fontVariant: ['tabular-nums'] }} selectable>{o.shippingPhone}</Txt>
                <IconButton icon="phone" label={`Llamar a ${o.recipientName}`} variant="tonal" onPress={() => Linking.openURL(`tel:${o.shippingPhone.replace(/[^\d+]/g, '')}`)} />
              </View>
              {o.shippingNotes && o.shippingNotes !== '[SYNTHETIC]' && (
                <View style={{ padding: 12, borderRadius: shape.md, backgroundColor: c.surfaceContainer }}>
                  <Txt variant="labelM" color={c.onSurfaceVariant}>Nota del cliente</Txt>
                  <Txt variant="bodyM">{o.shippingNotes}</Txt>
                </View>
              )}
              <Txt variant="bodyS" color={c.onSurfaceVariant}>{o.shippingLabel} · pagado el {shortDate(o.paidAt ?? o.createdAt)}</Txt>
            </Card>

            <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
              <Txt variant="titleM" style={{ padding: 16, paddingBottom: 8 }}>En este paquete</Txt>
              {o.items.map((it, i) => (
                <View key={i}>
                  {i > 0 && <Divider />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
                    <View style={{ minWidth: 36, height: 36, borderRadius: 18, backgroundColor: c.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt variant="titleS" color={c.onSecondaryContainer}>×{it.quantity}</Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="titleS">{it.name}</Txt>
                      <Txt variant="bodyS" color={c.onSurfaceVariant}>{it.sku}</Txt>
                    </View>
                  </View>
                </View>
              ))}
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
                <Txt variant="bodyM" color={c.onSurfaceVariant}>Total pagado</Txt>
                <Txt variant="titleM" style={{ fontVariant: ['tabular-nums'] }}>{clp(o.totalCLP)}</Txt>
              </View>
            </Card>

            {!o.canShip && o.status === 'SHIPPED' && (
              <Card variant="filled" style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Icon name="check" size={20} color={c.onTertiaryContainer} />
                <Txt variant="bodyM" style={{ flex: 1 }}>{o.isPickup ? 'Ya está listo para retiro.' : `Enviado${o.trackingNumber ? ` · seguimiento ${o.trackingNumber}` : ''}.`}</Txt>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {o?.canShip && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, gap: 12, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant }}>
          {!o.isPickup && <TextField label="N° de seguimiento (opcional)" value={tracking} onChangeText={setTracking} autoCapitalize="characters" maxLength={100} />}
          <Button label={o.isPickup ? 'Marcar listo para retiro' : 'Marcar como enviado'} icon={o.isPickup ? 'store' : 'truck'} size="lg" block loading={busy} onPress={confirmShip} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
