import { Redirect } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { useSession } from '@/lib/session';
import { cartCount, useCart } from '@/lib/cart';
import { NavBar, NavItem } from '@/ui/NavBar';

// La tienda: Inicio, Buscar, Carrito, Cuenta. Un vendedor que eligió la
// trastienda entra directo a ella.
export default function StoreLayout() {
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);
  const count = useCart((s) => cartCount(s.lines));
  if (user?.role === 'SELLER' && mode === 'seller') return <Redirect href="/hoy" />;

  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <NavBar>
          <TabTrigger name="index" href="/" asChild>
            <NavItem icon="home" label="Inicio" />
          </TabTrigger>
          <TabTrigger name="buscar" href="/buscar" asChild>
            <NavItem icon="search" label="Buscar" />
          </TabTrigger>
          <TabTrigger name="carrito" href="/carrito" asChild>
            <NavItem icon="bag" label="Carrito" badge={count} />
          </TabTrigger>
          <TabTrigger name="cuenta" href="/cuenta" asChild>
            <NavItem icon="user" label="Cuenta" />
          </TabTrigger>
        </NavBar>
      </TabList>
    </Tabs>
  );
}
