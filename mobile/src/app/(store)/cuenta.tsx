import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemePref } from '@/theme/ThemeProvider';
import { shape } from '@/theme/tokens';
import { Button, Card, Divider, LeadIcon, ListItem, Txt, tap } from '@/ui/core';
import { Icon } from '@/ui/Icon';
import { Paper } from '@/ui/brand';
import { useMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { SITE_URL } from '@/lib/api';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });

export default function Account() {
  const { c, pref, setPref } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const { logout, setMode } = useSession.getState();
  const me = useMe();

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
      <Txt variant="headlineM" accessibilityRole="header">Cuenta</Txt>

      {status !== 'authed' ? (
        <Paper radius={shape.xl} style={{ padding: 24, gap: 12 }}>
          <Txt variant="headlineS" color={c.onPaper}>Entra a tu cuenta</Txt>
          <Txt variant="bodyL" color={c.onPaper} style={{ opacity: 0.85 }}>Para seguir tus pedidos y comprar más rápido.</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Button label="Iniciar sesión" onPress={() => router.push('/login')} />
            <Button label="Crear cuenta" variant="text" onPress={() => openWeb('/registro')} />
          </View>
        </Paper>
      ) : (
        <Paper radius={shape.xl} style={{ padding: 24, minHeight: 168 }}>
          <Txt variant="bodyM" color={c.onPaper} style={{ opacity: 0.75 }}>회원증</Txt>
          <Txt variant="headlineM" color={c.onPaper} numberOfLines={2} style={{ marginTop: 20 }}>
            {[me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ') || user?.firstName || 'Tu cuenta'}
          </Txt>
          <Txt variant="bodyM" color={c.onPaper} style={{ opacity: 0.8 }} numberOfLines={1}>{user?.email}</Txt>
          {me.data && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 8 }}>
              <Txt variant="bodyS" color={c.onPaper} style={{ opacity: 0.85 }}>
                En Hachiko desde {MONTHS[new Date(me.data.memberSince).getMonth()]} {new Date(me.data.memberSince).getFullYear()}
              </Txt>
              <View style={{ height: 24, paddingHorizontal: 10, borderRadius: shape.full, backgroundColor: `${c.surfaceContainerLowest}CC`, justifyContent: 'center' }}>
                <Txt variant="labelM" color={c.onSurface}>{me.data.emailVerified ? 'Correo verificado' : 'Correo sin verificar'}</Txt>
              </View>
            </View>
          )}
        </Paper>
      )}

      {status === 'authed' && (
        <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
          <ListItem title="Mis pedidos" subtitle={me.data ? (me.data.orderCount === 0 ? 'Aún no compras' : `${me.data.orderCount} ${me.data.orderCount === 1 ? 'compra' : 'compras'}`) : undefined} leading={<LeadIcon icon="package" />} trailing={<Icon name="chevronRight" size={20} color={c.onSurfaceVariant} />} onPress={() => router.push('/pedidos')} />
          {user?.role === 'SELLER' && (
            <>
              <Divider inset />
              <ListItem title="Abrir la trastienda" subtitle="Pedidos por despachar e inventario" leading={<LeadIcon icon="store" tone="primary" />} trailing={<Icon name="chevronRight" size={20} color={c.onSurfaceVariant} />} onPress={() => { setMode('seller'); router.replace('/hoy'); }} />
            </>
          )}
        </Card>
      )}

      <Card variant="outlined" style={{ gap: 12 }}>
        <Txt variant="titleM">Apariencia</Txt>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.outline, borderRadius: shape.full, overflow: 'hidden' }}>
          {([['system', 'Automático'], ['light', 'Claro'], ['dark', 'Noche']] as [ThemePref, string][]).map(([k, label], i) => (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ checked: pref === k }}
              onPress={() => { tap(); setPref(k); }}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: pref === k ? c.secondary : 'transparent', borderLeftWidth: i ? 1 : 0, borderLeftColor: c.outline }}
            >
              {pref === k && <Icon name="check" size={16} color={c.onSecondary} />}
              <Txt variant="labelL" color={pref === k ? c.onSecondary : c.onSurface}>{label}</Txt>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
        <ListItem title="Tus datos personales" subtitle="Descargar o eliminar (Ley 21.719)" leading={<LeadIcon icon="lock" />} trailing={<Icon name="external" size={18} color={c.onSurfaceVariant} />} onPress={() => openWeb(status === 'authed' ? '/datos' : '/legal/privacidad')} />
        <Divider inset />
        <ListItem title="Despacho" leading={<LeadIcon icon="truck" />} trailing={<Icon name="external" size={18} color={c.onSurfaceVariant} />} onPress={() => openWeb('/legal/despacho')} />
        <Divider inset />
        <ListItem title="Cambios y devoluciones" leading={<LeadIcon icon="refresh" />} trailing={<Icon name="external" size={18} color={c.onSurfaceVariant} />} onPress={() => openWeb('/legal/devoluciones')} />
        <Divider inset />
        <ListItem title="Escríbenos" subtitle="hachiko.store.contacto@gmail.com" leading={<LeadIcon icon="mail" />} onPress={() => Linking.openURL('mailto:hachiko.store.contacto@gmail.com')} />
      </Card>

      {status === 'authed' && (
        <Button label="Cerrar sesión" icon="logout" variant="outlined" onPress={() => { tap(); void logout(); }} style={{ alignSelf: 'center', marginTop: 8 }} accessibilityHint="Cierra tu sesión en todos tus dispositivos" />
      )}
      <Txt variant="bodyS" color={c.onSurfaceVariant} style={{ textAlign: 'center', marginTop: 8 }}>Hachiko · Recoleta, Santiago</Txt>
    </ScrollView>
  );
}
