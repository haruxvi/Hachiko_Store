import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Chip, Skeleton, Stepper, Txt, tap } from '@/ui/core';
import { TextField } from '@/ui/TextField';
import { EmptyState, TopBar } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { api, ApiError } from '@/lib/api';
import { clp } from '@/lib/format';
import type { ScannedProduct } from '@/lib/types';

type Reason = 'RESTOCK' | 'RETURNED' | 'CORRECTION_UP' | 'CORRECTION_DOWN' | 'DAMAGED' | 'EXPIRED';

// Motivos con su efecto: los que suman piden "cuántas llegaron"; los que
// restan, "cuántas salen". Las correcciones piden una nota (queda auditado).
const REASONS: { key: Reason; label: string; sign: 1 | -1; note?: boolean }[] = [
  { key: 'RESTOCK', label: 'Llegó mercadería', sign: 1 },
  { key: 'RETURNED', label: 'Devolución', sign: 1 },
  { key: 'DAMAGED', label: 'Dañado', sign: -1 },
  { key: 'EXPIRED', label: 'Vencido', sign: -1 },
  { key: 'CORRECTION_UP', label: 'Corregir +', sign: 1, note: true },
  { key: 'CORRECTION_DOWN', label: 'Corregir −', sign: -1, note: true },
];

export default function AdjustStock() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['seller', 'product', sku], queryFn: () => api<ScannedProduct>(`/seller/products/by-code/${encodeURIComponent(sku)}`) });
  const [reason, setReason] = useState<Reason>('RESTOCK');
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const p = q.data;
  const r = REASONS.find((x) => x.key === reason)!;
  const maxDown = p ? Math.max(0, p.stock - (p.stock - p.available)) : 0; // no bajar de lo reservado
  const newStock = p ? Math.max(0, p.stock + r.sign * amount) : 0;
  const invalid = !p || (r.sign < 0 && amount > maxDown) || (r.note && note.trim().length < 3);

  const save = async () => {
    if (!p || invalid) return;
    setBusy(true);
    try {
      await api(`/seller/inventory/${encodeURIComponent(p.id)}/adjust`, { method: 'POST', body: { newStock, reason, ...(note.trim() ? { notes: note.trim() } : {}) } });
      tap('success');
      snack(`${p.name}: ${p.stock} → ${newStock}`);
      void qc.invalidateQueries({ queryKey: ['seller'] });
      router.back();
    } catch (e) {
      tap('warning');
      snack(e instanceof ApiError ? e.message : 'No se pudo ajustar el stock.');
    } finally {
      setBusy(false);
    }
  };

  if (q.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <TopBar title="Producto" />
        <EmptyState icon="scan" title="No encontramos ese código" body={`“${sku}” no corresponde a un producto.`} action={{ label: 'Escanear de nuevo', onPress: () => router.replace('/vendedor/escanear') }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="Ajustar stock" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 140 + insets.bottom }}>
        {!p ? (
          <Skeleton width="100%" height={140} radius={shape.lg} />
        ) : (
          <>
            <Card variant="outlined" style={{ gap: 4 }}>
              <Txt variant="labelM" color={c.onSurfaceVariant}>{p.sku} · {p.category} · {clp(p.priceCLP)}</Txt>
              <Txt variant="headlineS">{p.name}</Txt>
              <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
                <Metric label="En bodega" value={p.stock} />
                <Metric label="Disponibles" value={p.available} />
                <Metric label="Umbral" value={p.threshold} />
              </View>
              {p.archived && <Txt variant="bodyS" color={c.error} style={{ marginTop: 8 }}>Este producto está archivado (no se vende).</Txt>}
            </Card>

            <View style={{ gap: 10 }}>
              <Txt variant="titleM">¿Qué pasó?</Txt>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REASONS.map((x) => (
                  <Chip key={x.key} label={x.label} selected={reason === x.key} onPress={() => { setReason(x.key); setAmount(1); }} />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="titleM">{r.sign > 0 ? '¿Cuántas entran?' : '¿Cuántas salen?'}</Txt>
              <Stepper value={amount} max={r.sign > 0 ? 9999 : Math.max(1, maxDown)} onChange={setAmount} label="Cantidad" />
            </View>
            {r.sign > 0 && (
              // Atajos para cuando llega una caja entera.
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                {[6, 12, 24].map((n) => (
                  <Chip key={n} label={`+${n}`} onPress={() => { tap(); setAmount((a) => Math.min(9999, a + n)); }} />
                ))}
              </View>
            )}
            {r.sign < 0 && amount > maxDown && (
              <Txt variant="bodyM" color={c.error}>Solo puedes sacar {maxDown}: el resto está reservado en carritos que se están pagando.</Txt>
            )}
            {r.note && <TextField label="Motivo de la corrección" helper="Queda registrado en el historial." value={note} onChangeText={setNote} maxLength={500} />}
          </>
        )}
      </ScrollView>

      {p && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, gap: 8, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant }}>
          <Txt variant="bodyM" color={c.onSurfaceVariant} style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }} accessibilityLiveRegion="polite">
            Stock: {p.stock} → <Txt variant="titleS">{newStock}</Txt>
          </Txt>
          <Button label="Guardar ajuste" size="lg" block loading={busy} disabled={!!invalid} onPress={save} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const { c } = useTheme();
  return (
    <View>
      <Txt variant="headlineS" style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
      <Txt variant="labelM" color={c.onSurfaceVariant}>{label}</Txt>
    </View>
  );
}
