import { Redirect } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { useSession } from '@/lib/session';
import { useSellerToday } from '@/lib/queries';
import { NavBar, NavItem } from '@/ui/NavBar';

// La trastienda: solo para cuentas de vendedor (el servidor lo vuelve a
// verificar en cada petición; esto solo evita mostrar pantallas que fallarían).
export default function SellerLayout() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const today = useSellerToday();
  if (status !== 'loading' && user?.role !== 'SELLER') return <Redirect href="/" />;

  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <NavBar>
          <TabTrigger name="hoy" href="/hoy" asChild>
            <NavItem icon="chart" label="Hoy" />
          </TabTrigger>
          <TabTrigger name="despacho" href="/despacho" asChild>
            <NavItem icon="package" label="Pedidos" badge={today.data?.kpis.toPack} />
          </TabTrigger>
          <TabTrigger name="inventario" href="/inventario" asChild>
            <NavItem icon="list" label="Inventario" badge={today.data?.kpis.lowStockCount} />
          </TabTrigger>
          <TabTrigger name="mas" href="/mas" asChild>
            <NavItem icon="menu" label="Más" />
          </TabTrigger>
        </NavBar>
      </TabList>
    </Tabs>
  );
}
