import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/lib/format';
import { Chip, IconButton, Txt } from './core';

/** "Mostrar" + un chip por tamaño de página (va dentro de una fila de chips). */
export function PageSizeChips<N extends number>({ sizes, value, onChange }: { sizes: readonly N[]; value: N; onChange: (n: N) => void }) {
  const { c } = useTheme();
  return (
    <>
      <Txt variant="bodyM" color={c.onSurfaceVariant}>Mostrar</Txt>
      {sizes.map((n) => (
        <Chip key={n} label={String(n)} selected={value === n} onPress={() => onChange(n)} />
      ))}
    </>
  );
}

/** "Mostrando 25–48 de 57 productos" + anterior / siguiente. */
export function Pager({ page, totalPages, total, size, noun, onGo }: {
  page: number; totalPages: number; total: number; size: number; noun: [singular: string, plural: string]; onGo: (n: number) => void;
}) {
  const { c } = useTheme();
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16 }}>
      <Txt variant="bodyM" color={c.onSurfaceVariant} style={{ fontVariant: ['tabular-nums'] }}>
        Mostrando {from}–{to} de {plural(total, noun[0], noun[1])}
      </Txt>
      {totalPages > 1 && (
        <View accessibilityRole="toolbar" accessibilityLabel="Paginación" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <IconButton icon="chevronLeft" label="Página anterior" variant="outlined" onPress={hasPrev ? () => onGo(page - 1) : undefined} style={!hasPrev && { opacity: 0.38 }} />
          <Txt variant="titleM" style={{ fontVariant: ['tabular-nums'], minWidth: 120, textAlign: 'center' }}>Página {page} de {totalPages}</Txt>
          <IconButton icon="chevronRight" label="Página siguiente" variant="outlined" onPress={hasNext ? () => onGo(page + 1) : undefined} style={!hasNext && { opacity: 0.38 }} />
        </View>
      )}
    </View>
  );
}
