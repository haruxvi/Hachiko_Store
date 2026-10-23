import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Skeleton, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { TextField } from '@/ui/TextField';
import { SwitchRow } from '@/ui/SwitchRow';
import { EmptyState, TopBar } from '@/ui/layout';
import { snack } from '@/ui/Snackbar';
import { api, ApiError } from '@/lib/api';
import { refreshCatalog, useSellerCategory } from '@/lib/queries';
import { plural } from '@/lib/format';

// Si se llegó por un enlace directo no hay pantalla anterior: se va al listado.
const leave = () => (router.canGoBack() ? router.back() : router.replace('/vendedor/categorias'));

/** "Snacks coreanos" → "snacks-coreanos" (lo que acepta el servidor). */
const toSlug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

// Crear o editar una categoría. El slug se propone solo a partir del nombre
// (mientras no lo cambies a mano) y es la parte de la dirección del catálogo.
export default function CategoryFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nueva';
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const category = useSellerCategory(isNew ? undefined : id);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const cat = category.data;
  const [loaded, setLoaded] = useState<string>();
  if (cat && loaded !== cat.id) {
    setLoaded(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setSlugTouched(true);
    setDescription(cat.description ?? '');
    setOrder(String(cat.order));
    setActive(cat.active);
  }

  const orderN = /^-?\d{1,6}$/.test(order.trim()) ? Number(order.trim()) : null;
  const errors = {
    name: !name.trim() ? 'Escribe el nombre.' : null,
    slug: !/^[a-z0-9-]{1,100}$/.test(slug) ? 'Solo minúsculas, números y guiones (ej: snacks-coreanos).' : null,
    order: orderN === null ? 'Un número entero (0 va primero).' : null,
  };
  const firstError = Object.values(errors).find(Boolean);
  const show = (e: string | null) => (tried ? e : null);

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  };

  const save = async () => {
    setTried(true);
    if (firstError) {
      tap('warning');
      snack(firstError);
      return;
    }
    const body = { name: name.trim(), slug, description: description.trim() || undefined, order: orderN, active };
    setBusy(true);
    try {
      await api(isNew ? '/seller/categories' : `/seller/categories/${encodeURIComponent(id)}`, { method: 'POST', body });
      tap('success');
      snack(isNew ? 'Categoría creada' : 'Cambios guardados');
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
      await api(`/seller/categories/${encodeURIComponent(id)}/${archive ? 'archive' : 'restore'}`, { method: 'POST' });
      tap('success');
      refreshCatalog(qc);
      if (archive) {
        snack(`${name} archivada`, { label: 'Deshacer', onPress: () => void api(`/seller/categories/${encodeURIComponent(id)}/restore`, { method: 'POST' }).then(() => refreshCatalog(qc)) });
        leave();
      } else {
        // Restaurar la deja visible en el servidor; el formulario debe reflejarlo.
        setActive(true);
        snack(`${name} vuelve a la tienda`);
      }
    } catch (e) {
      snack(e instanceof ApiError ? e.message : 'No se pudo completar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (!isNew && category.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <TopBar title="Categoría" />
        <EmptyState icon="list" title="No encontramos esa categoría" action={{ label: 'Volver', onPress: leave }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={isNew ? 'Nueva categoría' : 'Editar categoría'} />
      {!isNew && !cat ? (
        <View style={{ padding: 16, gap: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={56} radius={shape.xs} />)}</View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 + insets.bottom }}>
          {cat?.archived && (
            <Card variant="filled" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.errorContainer }}>
              <Icon name="alert" size={20} color={c.onErrorContainer} />
              <Txt variant="bodyM" color={c.onErrorContainer} style={{ flex: 1 }}>Archivada: no aparece en la tienda hasta que la restaures.</Txt>
            </Card>
          )}
          {cat && <Txt variant="bodyM" color={c.onSurfaceVariant}>{plural(cat.productCount, 'producto', 'productos')} en esta categoría.</Txt>}

          <TextField label="Nombre" value={name} onChangeText={onName} maxLength={100} error={show(errors.name)} />
          <TextField
            label="Dirección web (slug)"
            value={slug}
            onChangeText={(v) => { setSlug(v.toLowerCase()); setSlugTouched(true); }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            error={show(errors.slug)}
            helper={`En la tienda: /catalogo?categoria=${slug || '…'}`}
          />
          <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} multiline maxLength={500} style={{ minHeight: 80, textAlignVertical: 'top' }} />
          <TextField label="Orden en la vitrina" value={order} onChangeText={setOrder} keyboardType="numbers-and-punctuation" maxLength={7} error={show(errors.order)} helper="Las de número más bajo van primero." />
          <SwitchRow label="Visible en la tienda" helper="Si la apagas, la categoría no se muestra a los clientes." value={active} onChange={setActive} />

          {!isNew && cat && (
            <Button
              label={cat.archived ? 'Restaurar categoría' : 'Archivar categoría'}
              icon={cat.archived ? 'refresh' : 'trash'}
              variant="text"
              onPress={() => void setArchived(!cat.archived)}
              disabled={busy}
              accessibilityHint={cat.archived ? 'Vuelve a la tienda' : 'Deja de mostrarse; se puede restaurar'}
              style={{ alignSelf: 'center' }}
            />
          )}
        </ScrollView>
      )}

      {(isNew || cat) && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: c.surfaceContainerLow, borderTopWidth: 1, borderTopColor: c.outlineVariant }}>
          <Button label={isNew ? 'Crear categoría' : 'Guardar cambios'} size="lg" block loading={busy} onPress={() => void save()} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
