import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Divider, LeadIcon, ListItem, Txt, tap } from '@/ui/core';
import { Icon, type IconName } from '@/ui/Icon';
import { useSession } from '@/lib/session';
import { SITE_URL } from '@/lib/api';

// "Más": lo que se usa menos desde el celular se abre en el panel web
// (inteligencia, promociones, seguridad). Aquí, solo los accesos.
const WEB: { title: string; subtitle: string; icon: IconName; path: string }[] = [
  { title: 'Métricas', subtitle: 'Ventas, margen y clasificación ABC', icon: 'chart', path: '/trastienda/metricas' },
  { title: 'Qué reponer', subtitle: 'Compras sugeridas por el modelo', icon: 'truck', path: '/trastienda/reponer' },
  { title: 'Demanda', subtitle: 'Pronóstico del mes', icon: 'refresh', path: '/trastienda/demanda' },
  { title: 'Riesgo', subtitle: 'Fraude y cuentas en riesgo', icon: 'alert', path: '/trastienda/riesgo' },
  { title: 'Promociones', subtitle: 'Correos a quienes aceptaron recibirlos', icon: 'mail', path: '/trastienda/promociones' },
  { title: 'Productos y carga masiva', subtitle: 'Crear, editar y subir planillas', icon: 'tag', path: '/trastienda/productos' },
];

export default function More() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout, setMode } = useSession.getState();
  const user = useSession((s) => s.user);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
      <Txt variant="headlineM" accessibilityRole="header">Más</Txt>

      <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
        <ListItem title="Ver la tienda" subtitle="Como la ven tus clientes" leading={<LeadIcon icon="store" tone="primary" />} trailing={<Icon name="chevronRight" size={20} color={c.onSurfaceVariant} />} onPress={() => { tap(); setMode('store'); router.replace('/'); }} />
      </Card>

      <View style={{ gap: 8 }}>
        <Txt variant="titleM">En el panel web</Txt>
        <Txt variant="bodyM" color={c.onSurfaceVariant}>Se abren en el navegador; la primera vez te pedirá iniciar sesión.</Txt>
      </View>
      <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
        {WEB.map((w, i) => (
          <View key={w.path}>
            {i > 0 && <Divider inset />}
            <ListItem title={w.title} subtitle={w.subtitle} leading={<LeadIcon icon={w.icon} />} trailing={<Icon name="external" size={18} color={c.onSurfaceVariant} />} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}${w.path}`)} />
          </View>
        ))}
      </Card>

      <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
        <ListItem title="Mi cuenta" subtitle={user?.email} leading={<LeadIcon icon="user" />} trailing={<Icon name="chevronRight" size={20} color={c.onSurfaceVariant} />} onPress={() => { setMode('store'); router.replace('/cuenta'); }} />
      </Card>

      <Button label="Cerrar sesión" icon="logout" variant="outlined" onPress={() => { tap(); void logout().then(() => router.replace('/')); }} style={{ alignSelf: 'center' }} />
    </ScrollView>
  );
}
