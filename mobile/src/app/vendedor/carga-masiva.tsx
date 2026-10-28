import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Divider, LeadIcon, ListItem, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { TopBar } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { api, ApiError, fileField, SITE_URL } from '@/lib/api';
import { refreshCatalog } from '@/lib/queries';
import { clp, plural } from '@/lib/format';
import type { ImportResult } from '@/lib/types';

const MAX_BYTES = 2 * 1024 * 1024;
type Picked = { uri: string; name: string; size?: number; mimeType?: string; file?: File };

// Carga masiva con la misma plantilla y las mismas reglas que el panel web:
// 1) eliges el archivo, 2) se valida y ves qué va a pasar (nada se guarda),
// 3) confirmas y se guarda todo o nada. Un SKU que ya existe suma stock.
export default function BulkImport() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [file, setFile] = useState<Picked | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<{ created: number; restocked: number } | null>(null);
  const [busy, setBusy] = useState<'validate' | 'commit' | null>(null);

  const send = async (f: Picked, commit: boolean) => {
    const form = new FormData();
    form.append('file', fileField(f), f.name);
    if (commit) form.append('confirmar', '1');
    return api<ImportResult>('/seller/products/import', { form });
  };

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'public.comma-separated-values-text'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (!/\.(csv|xlsx)$/i.test(a.name)) {
      snack('Elige un archivo .csv o .xlsx (la plantilla de Excel).');
      return;
    }
    if (a.size && a.size > MAX_BYTES) {
      snack('El archivo supera 2 MB.');
      return;
    }
    const f = { uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType, file: a.file };
    setFile(f);
    setDone(null);
    setResult(null);
    setBusy('validate');
    try {
      setResult(await send(f, false));
    } catch (e) {
      snack(e instanceof ApiError ? e.message : 'No se pudo validar el archivo.');
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy('commit');
    try {
      const r = await send(file, true);
      if (!r.ok) {
        tap('warning');
        setResult(r);
        return;
      }
      tap('success');
      refreshCatalog(qc);
      setDone({ created: r.createdCount, restocked: r.restockedCount });
      setResult(null);
      setFile(null);
    } catch (e) {
      // Sin respuesta no sabemos si se guardó: se pide validar de nuevo antes de reintentar.
      snack(e instanceof ApiError && e.status !== 0 ? e.message : 'No se recibió confirmación. Valida el archivo otra vez para ver si se guardó.');
    } finally {
      setBusy(null);
    }
  };

  const preview = result?.ok ? (result.preview ?? []) : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title="Carga masiva" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 + insets.bottom }}>
        {done ? (
          <Card variant="filled" style={{ gap: 8, backgroundColor: c.tertiaryContainer }}>
            <Icon name="check" size={28} color={c.onTertiaryContainer} />
            <Txt variant="headlineS" color={c.onTertiaryContainer}>Carga guardada</Txt>
            <Txt variant="bodyL" color={c.onTertiaryContainer}>
              {[done.created ? plural(done.created, 'producto nuevo', 'productos nuevos') : null, done.restocked ? `${plural(done.restocked, 'reposición', 'reposiciones')} de stock` : null].filter(Boolean).join(' y ')}.
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Button label="Ver productos" onPress={() => router.replace('/vendedor/productos')} />
              <Button label="Cargar otro archivo" variant="text" onPress={() => setDone(null)} />
            </View>
          </Card>
        ) : (
          <Card variant="outlined" style={{ gap: 8 }}>
            <Txt variant="titleM">Cómo funciona</Txt>
            <Step n={1} text="Completa la plantilla de Excel (o un CSV con las mismas columnas)." />
            <Step n={2} text="Elige el archivo: lo validamos y te mostramos qué va a pasar. Nada se guarda todavía." />
            <Step n={3} text="Confirma: se guarda todo o nada. Si un SKU ya existe, se suma su stock." />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <Button label="Plantilla Excel" icon="external" variant="text" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/plantilla-productos-hachiko.xlsx`)} />
              <Button label="Columnas y categorías" icon="external" variant="text" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/trastienda/productos/importar`)} />
            </View>
          </Card>
        )}

        {!done && (
          <Button label={file ? 'Elegir otro archivo' : 'Elegir archivo (.xlsx o .csv)'} icon="plus" variant={file ? 'outlined' : 'filled'} size="lg" block loading={busy === 'validate'} onPress={() => void pick()} />
        )}
        {file && !done && (
          <Txt variant="bodyM" color={c.onSurfaceVariant} style={{ textAlign: 'center' }} numberOfLines={1}>
            {file.name}{file.size ? ` · ${Math.max(1, Math.round(file.size / 1024))} KB` : ''}
          </Txt>
        )}

        {result && !result.ok && (
          <Card variant="filled" style={{ gap: 10, backgroundColor: c.errorContainer }} accessibilityLabel={`El archivo tiene ${result.issues.length} observaciones`}>
            <Txt variant="titleM" color={c.onErrorContainer}>Corrige esto y vuelve a subirlo</Txt>
            <Txt variant="bodyS" color={c.onErrorContainer}>No se guardó nada.</Txt>
            {result.issues.slice(0, 50).map((i, k) => (
              <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
                <Txt variant="labelL" color={c.onErrorContainer} style={{ minWidth: 56 }}>{i.row > 0 ? `Fila ${i.row}` : 'Archivo'}</Txt>
                <Txt variant="bodyM" color={c.onErrorContainer} style={{ flex: 1 }}>{i.message}</Txt>
              </View>
            ))}
            {result.issues.length > 50 && <Txt variant="bodyS" color={c.onErrorContainer}>…y {result.issues.length - 50} más.</Txt>}
          </Card>
        )}

        {result?.ok && (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Summary label="Productos nuevos" value={result.createdCount} tone={[c.secondaryContainer, c.onSecondaryContainer]} />
              <Summary label="Reposiciones" value={result.restockedCount} tone={[c.tertiaryContainer, c.onTertiaryContainer]} />
            </View>
            {!!result.recoveredIdentifiers && (
              <Txt variant="bodyS" color={c.onSurfaceVariant}>Completamos {plural(result.recoveredIdentifiers, 'SKU o slug vacío', 'SKU o slugs vacíos')} a partir del nombre.</Txt>
            )}
            <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
              {preview.slice(0, 100).map((r, k) => (
                <View key={`${r.row}-${r.sku}`}>
                  {k > 0 && <Divider inset />}
                  <ListItem
                    title={r.name}
                    subtitle={`Fila ${r.row} · ${r.sku} · ${r.category} · ${clp(r.price)}${r.operation === 'create' && !r.active ? ' · oculto' : ''}`}
                    lines={2}
                    leading={<LeadIcon icon={r.operation === 'create' ? 'plus' : 'refresh'} tone={r.operation === 'create' ? 'secondary' : 'tertiary'} />}
                    trailing={
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt variant="titleS" style={{ fontVariant: ['tabular-nums'] }}>{r.operation === 'create' ? r.resultingStock : `+${r.stock}`}</Txt>
                        <Txt variant="labelS" color={c.onSurfaceVariant} style={{ fontVariant: ['tabular-nums'] }}>{r.operation === 'create' ? 'stock' : `${r.currentStock} → ${r.resultingStock}`}</Txt>
                      </View>
                    }
                  />
                </View>
              ))}
            </Card>
            {preview.length > 100 && <Txt variant="bodyS" color={c.onSurfaceVariant} style={{ textAlign: 'center' }}>Se muestran las primeras 100 de {preview.length} filas.</Txt>}
          </>
        )}
      </ScrollView>

      {result?.ok && file && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, gap: 6, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant }}>
          <Txt variant="bodyS" color={c.onSurfaceVariant} style={{ textAlign: 'center' }}>Se guarda todo junto o nada.</Txt>
          <Button label={`Confirmar ${plural(result.count, 'fila', 'filas')}`} size="lg" block loading={busy === 'commit'} disabled={busy === 'validate'} onPress={() => void commit()} />
        </View>
      )}
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.secondary, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="labelM" color={c.onSecondary}>{n}</Txt>
      </View>
      <Txt variant="bodyM" style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: [string, string] }) {
  return (
    <View style={{ flex: 1, padding: 16, borderRadius: shape.lg, backgroundColor: tone[0] }}>
      <Txt variant="headlineM" color={tone[1]} style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
      <Txt variant="labelL" color={tone[1]}>{label}</Txt>
    </View>
  );
}
