import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, shape } from '@/theme/tokens';
import { Chip, Divider, IconButton, LeadIcon, ListItem, Skeleton } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { ExtendedFab } from '@/ui/Fab';
import { EmptyState, TopBar } from '@/ui/layout';
import { PageSizeChips, Pager } from '@/ui/Pager';
import { LIST_PAGE_SIZES, useSellerCategories, type ListPageSize } from '@/lib/queries';
import { plural } from '@/lib/format';
import type { SellerCategory } from '@/lib/types';

// Categorías de la tienda: en el orden en que se muestran en la vitrina. Tocar
// una para editarla; "+" crea una nueva; las archivadas se ven aparte.
export default function Categories() {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [archivadas, setArchivadas] = useState(false);
  const [size, setSize] = useState<ListPageSize>(20);
  const [page, setPage] = useState(1);
  const list = useRef<FlatList<SellerCategory>>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const filterKey = `${q}|${archivadas}|${size}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }
  const cats = useSellerCategories(q, archivadas, page, size);
  const goTo = (n: number) => {
    setPage(n);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title="Categorías" />

      <View style={{ marginHorizontal: 16, marginTop: 4, height: 48, borderRadius: shape.full, backgroundColor: c.surfaceContainerHigh, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, gap: 10 }}>
        <Icon name="search" size={20} color={c.onSurfaceVariant} />
        <TextInput value={text} onChangeText={setText} placeholder="Nombre o slug" placeholderTextColor={c.onSurfaceVariant} accessibilityLabel="Buscar categoría" autoCapitalize="none" maxLength={100} style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.onSurface, height: 48 }} />
        {text.length > 0 && <IconButton icon="close" label="Borrar búsqueda" size={40} onPress={() => setText('')} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Chip label="Activas" selected={!archivadas} onPress={() => setArchivadas(false)} />
        <Chip label="Archivadas" selected={archivadas} onPress={() => setArchivadas(true)} />
        <View style={{ width: 1, height: 20, backgroundColor: c.outlineVariant, marginHorizontal: 4 }} />
        <PageSizeChips sizes={LIST_PAGE_SIZES} value={size} onChange={setSize} />
      </ScrollView>

      <FlatList
        ref={list}
        data={cats.data?.items ?? []}
        keyExtractor={(x) => x.id}
        ItemSeparatorComponent={() => <Divider inset />}
        refreshControl={<RefreshControl refreshing={cats.isRefetching} onRefresh={() => void cats.refetch()} tintColor={c.primaryStrong} colors={[c.primaryStrong]} />}
        keyboardDismissMode="on-drag"
        style={{ opacity: cats.isPlaceholderData ? 0.6 : 1 }}
        contentContainerStyle={{ paddingBottom: 104 }}
        renderItem={({ item: x }) => (
          <ListItem
            title={x.name}
            subtitle={[plural(x.productCount, 'producto', 'productos'), `/${x.slug}`, !x.active && !x.archived ? 'Oculta en la tienda' : null].filter(Boolean).join(' · ')}
            leading={<LeadIcon icon="list" tone={x.archived ? 'error' : x.active ? 'secondary' : 'tertiary'} />}
            trailing={<Icon name="chevronRight" size={20} color={c.onSurfaceVariant} />}
            onPress={() => router.push({ pathname: '/vendedor/categoria/[id]', params: { id: x.id } })}
          />
        )}
        ListFooterComponent={cats.data && cats.data.total > 0 ? <Pager page={cats.data.page} totalPages={cats.data.totalPages} total={cats.data.total} size={size} noun={['categoría', 'categorías']} onGo={goTo} /> : undefined}
        ListEmptyComponent={
          cats.isLoading ? (
            <View style={{ padding: 16, gap: 14 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={44} />)}</View>
          ) : cats.isError ? (
            <EmptyState icon="refresh" title="No pudimos cargar las categorías" action={{ label: 'Reintentar', onPress: () => cats.refetch() }} />
          ) : archivadas ? (
            <EmptyState icon="check" title="Nada archivado" body="Las categorías que archives aparecen aquí y se pueden restaurar." />
          ) : (
            <EmptyState icon="list" title={q ? 'Sin resultados' : 'Aún no hay categorías'} action={q ? undefined : { label: 'Nueva categoría', onPress: () => router.push({ pathname: '/vendedor/categoria/[id]', params: { id: 'nueva' } }) }} />
          )
        }
      />
      <ExtendedFab icon="plus" label="Nueva categoría" onPress={() => router.push({ pathname: '/vendedor/categoria/[id]', params: { id: 'nueva' } })} />
    </View>
  );
}
