import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Chip, IconButton, Skeleton, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { TextField } from '@/ui/TextField';
import { SwitchRow } from '@/ui/SwitchRow';
import { EmptyState, TopBar } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { api, ApiError, fileField } from '@/lib/api';
import { refreshCatalog, useCategoryOptions, useSellerProduct } from '@/lib/queries';
import { clp } from '@/lib/format';

// Si se llegó por un enlace directo no hay pantalla anterior: se va al listado.
const leave = () => (router.canGoBack() ? router.back() : router.replace('/vendedor/productos'));

const MAX_IMAGES = 10;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

type Photo = { raw: string; display: string };

/** Entero ≥ 0 escrito por el vendedor, o null si no es un número. */
const int = (s: string) => (/^\d{1,9}$/.test(s.trim()) ? Number(s.trim()) : null);

// Crear o editar un producto. Mismas reglas que el panel web (las valida el
// servidor): aquí solo se avisa antes lo obvio para no hacer viajes de más.
// El stock de un producto existente se cambia en "Ajustar stock" (queda el
// movimiento con su motivo), no aquí.
export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nuevo';
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const product = useSellerProduct(isNew ? undefined : id);
  const categories = useCategoryOptions();

  const [name, setName] = useState('');
  const [nameKorean, setNameKorean] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [weight, setWeight] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosChanged, setPhotosChanged] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Al llegar la ficha, se llena el formulario (ajuste en el render, sin efecto).
  const p = product.data;
  const [loaded, setLoaded] = useState<string>();
  if (p && loaded !== p.id) {
    setLoaded(p.id);
    setName(p.name);
    setNameKorean(p.nameKorean ?? '');
    setSku(p.sku);
    setCategoryId(p.categoryId);
    setDescription(p.description);
    setPrice(String(p.priceCLP));
    setCost(p.costCLP ? String(p.costCLP) : '');
    setThreshold(String(p.lowStockThreshold));
    setWeight(String(p.weightGrams));
    setPhotos(p.images.map((raw, i) => ({ raw, display: p.imageUrls[i] ?? raw })));
    setActive(p.active);
    setFeatured(p.featured);
  }

  const priceN = int(price);
  const costN = cost.trim() ? int(cost) : undefined;
  const errors = {
    name: !name.trim() ? 'Escribe el nombre.' : null,
    sku: !sku.trim() ? 'Escribe el SKU (código interno).' : null,
    category: !categoryId ? 'Elige una categoría.' : null,
    description: !description.trim() ? 'Escribe una descripción para la tienda.' : null,
    price: !priceN ? 'Precio en pesos, sin puntos (ej: 4990).' : null,
    cost: costN === null || costN === 0 ? 'Costo en pesos, sin puntos, o déjalo vacío.' : null,
    stock: isNew && int(stock) === null ? 'Cantidad en bodega (0 o más).' : null,
    threshold: int(threshold) === null ? 'Número (0 o más).' : null,
    weight: !int(weight) ? 'Peso en gramos (para el despacho).' : null,
  };
  const firstError = Object.values(errors).find(Boolean);
  const show = (e: string | null) => (tried ? e : null);
  const margin = priceN && costN ? Math.round(((priceN - costN) / priceN) * 100) : null;

  const addPhoto = (photo: Photo) => {
    setPhotos((list) => [...list, photo].slice(0, MAX_IMAGES));
    setPhotosChanged(true);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.fileSize && a.fileSize > MAX_PHOTO_BYTES) {
      snack('La foto supera 4 MB. Elige una más liviana.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      const name = a.fileName ?? 'foto.jpg';
      form.append('file', fileField({ uri: a.uri, name, mimeType: a.mimeType ?? 'image/jpeg', file: a.file }), name);
      const { url } = await api<{ url: string }>('/seller/products/images', { form });
      addPhoto({ raw: url, display: url });
      tap('success');
    } catch (e) {
      tap('warning');
      snack(e instanceof ApiError ? e.message : 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  const addPhotoUrl = () => {
    const url = photoUrl.trim();
    if (!/^https:\/\/\S+$/.test(url)) {
      snack('La URL debe empezar con https://');
      return;
    }
    addPhoto({ raw: url, display: url });
    setPhotoUrl('');
  };

  const save = async () => {
    setTried(true);
    if (firstError) {
      tap('warning');
      snack(firstError);
      return;
    }
    const data = {
      name: name.trim(),
      nameKorean: nameKorean.trim() || undefined,
      sku: sku.trim(),
      categoryId,
      description: description.trim(),
      priceCLP: priceN,
      costCLP: costN,
      lowStockThreshold: int(threshold),
      weightGrams: int(weight),
      active,
      featured,
    };
    setBusy(true);
    try {
      if (isNew) {
        await api('/seller/products', { method: 'POST', body: { ...data, stock: int(stock), images: photos.map((x) => x.raw) } });
        snack('Producto creado');
      } else {
        // Las fotos se reenvían solo si cambiaron (las antiguas pueden ser rutas internas).
        await api(`/seller/products/${encodeURIComponent(id)}`, { method: 'POST', body: { ...data, ...(photosChanged ? { images: photos.map((x) => x.raw) } : {}) } });
        snack('Cambios guardados');
      }
      tap('success');
      refreshCatalog(qc);
      leave();
    } catch (e) {
      tap('warning');
      snack(e instanceof ApiError ? e.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const setArchived = async (archive: boolean) => {
    setBusy(true);
    try {
      await api(`/seller/products/${encodeURIComponent(id)}/${archive ? 'archive' : 'restore'}`, { method: 'POST' });
      tap('success');
      refreshCatalog(qc);
      if (archive) {
        // Archivar se deshace en un toque; no hace falta pedir confirmación.
        snack(`${name} archivado`, { label: 'Deshacer', onPress: () => void api(`/seller/products/${encodeURIComponent(id)}/restore`, { method: 'POST' }).then(() => refreshCatalog(qc)) });
        leave();
      } else {
        // Restaurar lo deja visible en el servidor; el formulario debe reflejarlo
        // para que un "Guardar" posterior no lo vuelva a ocultar.
        setActive(true);
        snack(`${name} vuelve a la venta`);
      }
    } catch (e) {
      snack(e instanceof ApiError ? e.message : 'No se pudo completar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (!isNew && product.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <TopBar title="Producto" />
        <EmptyState icon="tag" title="No encontramos ese producto" action={{ label: 'Volver', onPress: leave }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={isNew ? 'Nuevo producto' : 'Editar producto'} />
      {!isNew && !p ? (
        <View style={{ padding: 16, gap: 16 }}>
          <Skeleton width="100%" height={110} radius={shape.lg} />
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={56} />)}
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 + insets.bottom }}>
          {p?.archived && (
            <Card variant="filled" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.errorContainer }}>
              <Icon name="alert" size={20} color={c.onErrorContainer} />
              <Txt variant="bodyM" color={c.onErrorContainer} style={{ flex: 1 }}>Archivado: no se vende hasta que lo restaures.</Txt>
            </Card>
          )}

          <Section title="Datos">
            <TextField label="Nombre" value={name} onChangeText={setName} maxLength={200} error={show(errors.name)} />
            <TextField label="Nombre en coreano (opcional)" value={nameKorean} onChangeText={setNameKorean} maxLength={200} helper="Se ve en la tarjeta del producto." />
            <TextField label="SKU" value={sku} onChangeText={setSku} autoCapitalize="characters" autoCorrect={false} maxLength={50} error={show(errors.sku)} helper="Código interno único; también sirve para reponer con la carga masiva." />
            <TextField label="Descripción" value={description} onChangeText={setDescription} multiline maxLength={5000} error={show(errors.description)} style={{ minHeight: 96, textAlignVertical: 'top' }} />
          </Section>

          <Section title="Fotos" helper={`Hasta ${MAX_IMAGES}. La primera es la portada en la tienda.`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {photos.map((ph, i) => (
                <View key={`${ph.raw}-${i}`} style={{ width: 88, height: 88 }}>
                  <Image source={ph.display} style={{ width: 88, height: 88, borderRadius: shape.md, backgroundColor: c.surfaceContainerHigh }} contentFit="cover" accessibilityLabel={i === 0 ? 'Foto de portada' : `Foto ${i + 1}`} />
                  <IconButton
                    icon="close"
                    label={`Quitar foto ${i + 1}`}
                    variant="glass"
                    size={32}
                    onPress={() => { setPhotos((list) => list.filter((_, j) => j !== i)); setPhotosChanged(true); }}
                    style={{ position: 'absolute', top: 2, right: 2 }}
                  />
                </View>
              ))}
              {photos.length < MAX_IMAGES && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Agregar foto desde la galería"
                  disabled={uploading}
                  onPress={() => void pickPhoto()}
                  style={({ pressed }) => ({ width: 88, height: 88, borderRadius: shape.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.outline, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: pressed ? c.surfaceContainerHigh : 'transparent' })}
                >
                  <Icon name={uploading ? 'refresh' : 'plus'} size={24} color={c.onSurfaceVariant} />
                  <Txt variant="labelM" color={c.onSurfaceVariant}>{uploading ? 'Subiendo…' : 'Foto'}</Txt>
                </Pressable>
              )}
            </ScrollView>
            {/* Pegar una URL es la vía secundaria: se muestra solo si se pide. */}
            {photos.length < MAX_IMAGES &&
              (showUrl ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TextField label="URL https de la foto" value={photoUrl} onChangeText={setPhotoUrl} autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={500} onSubmitEditing={addPhotoUrl} returnKeyType="done" />
                  </View>
                  <Button label="Agregar" variant="tonal" onPress={addPhotoUrl} disabled={!photoUrl.trim()} style={{ marginTop: 4 }} />
                </View>
              ) : (
                <Button label="Pegar URL de una foto" variant="text" onPress={() => setShowUrl(true)} style={{ alignSelf: 'flex-start' }} />
              ))}
          </Section>

          <Section title="Categoría" helper={show(errors.category) ?? undefined} helperError={!!show(errors.category)}>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.isLoading
                ? [0, 1, 2].map((i) => <Skeleton key={i} width={90} height={32} />)
                : (categories.data?.items ?? []).map((cat) => <Chip key={cat.id} label={cat.name} selected={categoryId === cat.id} onPress={() => setCategoryId(cat.id)} />)}
            </View>
          </Section>

          <Section title="Precio y stock">
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField label="Precio (CLP)" value={price} onChangeText={setPrice} keyboardType="number-pad" maxLength={9} error={show(errors.price)} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Costo (opcional)" value={cost} onChangeText={setCost} keyboardType="number-pad" maxLength={9} error={show(errors.cost)} helper={margin !== null ? `Margen ${margin}%` : undefined} />
              </View>
            </View>
            {isNew ? (
              <TextField label="Stock inicial" value={stock} onChangeText={setStock} keyboardType="number-pad" maxLength={5} error={show(errors.stock)} />
            ) : (
              p && (
                <Card variant="outlined" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="titleM" style={{ fontVariant: ['tabular-nums'] }}>{p.stock} en bodega</Txt>
                    <Txt variant="bodyS" color={c.onSurfaceVariant}>Se cambia con un motivo (queda en el historial).</Txt>
                  </View>
                  <Button label="Ajustar" variant="tonal" onPress={() => router.push({ pathname: '/vendedor/stock/[sku]', params: { sku: p.sku } })} />
                </Card>
              )
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextField label="Umbral bajo stock" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" maxLength={5} error={show(errors.threshold)} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Peso (g)" value={weight} onChangeText={setWeight} keyboardType="number-pad" maxLength={6} error={show(errors.weight)} />
              </View>
            </View>
          </Section>

          <Section title="En la tienda">
            <SwitchRow label="Visible en la tienda" helper="Si lo apagas, no aparece en la vitrina." value={active} onChange={setActive} />
            <SwitchRow label="Destacado" helper="Aparece primero en la vitrina." value={featured} onChange={setFeatured} />
          </Section>

          {!isNew && p && (
            <Button
              label={p.archived ? 'Restaurar producto' : 'Archivar producto'}
              icon={p.archived ? 'refresh' : 'trash'}
              variant="text"
              onPress={() => void setArchived(!p.archived)}
              disabled={busy}
              accessibilityHint={p.archived ? 'Vuelve a la venta' : 'Deja de venderse; se puede restaurar'}
              style={{ alignSelf: 'center' }}
            />
          )}
        </ScrollView>
      )}

      {(isNew || p) && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, gap: 6, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant }}>
          {priceN ? <Txt variant="bodyS" color={c.onSurfaceVariant} style={{ textAlign: 'center' }}>Se venderá a {clp(priceN)}</Txt> : null}
          <Button label={isNew ? 'Crear producto' : 'Guardar cambios'} size="lg" block loading={busy} onPress={() => void save()} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Section({ title, helper, helperError, children }: { title: string; helper?: string; helperError?: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Txt variant="titleM" accessibilityRole="header">{title}</Txt>
        {helper && <Txt variant="bodyS" color={helperError ? c.error : c.onSurfaceVariant}>{helper}</Txt>}
      </View>
      {children}
    </View>
  );
}
