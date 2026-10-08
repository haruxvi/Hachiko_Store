import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, IconButton, Txt, tap } from '@/ui/core';
import { TextField } from '@/ui/TextField';

// Escáner del vendedor: lee el código de la etiqueta (SKU) y abre el ajuste de
// stock. Si no hay cámara o no hay permiso, se puede escribir el código.
export default function Scan() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const handled = useRef(false);

  const open = (code: string) => {
    const sku = code.trim();
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(sku)) return;
    tap('success');
    router.replace({ pathname: '/vendedor/stock/[sku]', params: { sku } });
  };
  const onScan = (r: BarcodeScanningResult) => {
    if (handled.current) return;
    handled.current = true;
    open(r.data);
  };

  const canScan = Platform.OS !== 'web' && permission?.granted;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {canScan ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a'] }}
          onBarcodeScanned={onScan}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: c.inverseSurface }}>
          <Txt variant="headlineS" color={c.inverseOnSurface} style={{ textAlign: 'center' }}>
            {Platform.OS === 'web' ? 'El escáner funciona en el teléfono' : 'Necesitamos la cámara'}
          </Txt>
          <Txt variant="bodyL" color={c.inverseOnSurface} style={{ textAlign: 'center', opacity: 0.8 }}>
            {Platform.OS === 'web' ? 'Aquí puedes escribir el código del producto.' : 'Solo para leer el código de los productos. Nada se graba.'}
          </Txt>
          {Platform.OS !== 'web' && permission && !permission.granted && (
            <Button label={permission.canAskAgain ? 'Permitir la cámara' : 'Abrir ajustes'} onPress={() => void requestPermission()} />
          )}
        </View>
      )}

      {/* Marco de enfoque */}
      {canScan && (
        <View pointerEvents="none" style={{ position: 'absolute', top: '32%', left: '12%', right: '12%', height: 160, borderRadius: shape.lg, borderWidth: 3, borderColor: c.primary }} />
      )}

      <View style={{ position: 'absolute', top: insets.top + 8, left: 8 }}>
        <IconButton icon="close" label="Cerrar escáner" variant="glass" onPress={() => router.back()} />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, gap: 12, backgroundColor: c.surface, borderTopLeftRadius: shape.xl, borderTopRightRadius: shape.xl }}>
        <Txt variant="titleM">{canScan ? 'Apunta al código de la etiqueta' : 'Código del producto'}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField label="O escribe el SKU" value={manual} onChangeText={setManual} autoCapitalize="characters" returnKeyType="go" onSubmitEditing={() => open(manual)} maxLength={50} />
          </View>
          <Button label="Buscar" onPress={() => open(manual)} disabled={!manual.trim()} style={{ minHeight: 56 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
