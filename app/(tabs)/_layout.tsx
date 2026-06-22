import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  const isGarcom = user?.cargo === 'garcom';
  const isAdminOuGerente = user?.cargo === 'admin' || user?.cargo === 'gerente';
  const isCozinha = user?.cargo === 'cozinha';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8D0000',
        tabBarInactiveTintColor: '#AAA',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopColor: '#EEE',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="cozinha/index"
        options={{
          title: 'Cozinha',
          tabBarIcon: ({ color }) => <Feather name="clock" size={22} color={color} />,
          href: isCozinha ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="mesas/index"
        options={{
          title: 'Mesas',
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
          href: isGarcom || isAdminOuGerente ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin/index"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => <Feather name="shield" size={22} color={color} />,
          href: isAdminOuGerente ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="perfil-funcionario/index"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
      
      <Tabs.Screen name="mesas/[id]/nova-comanda"    options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/cardapio"        options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/comanda"         options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/confirmar-chegada" options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/produto/[produtoId]" options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/combo/[comboId]" options={{ href: null }} />
      <Tabs.Screen name="mesas/online"                options={{ href: null }} />
      <Tabs.Screen name="mesas/novo-pedido-delivery"  options={{ href: null }} />
      <Tabs.Screen name="mesas/qr-code"               options={{ href: null }} />
      <Tabs.Screen name="admin/clientes"              options={{ href: null }} />
      <Tabs.Screen name="admin/mesas"                 options={{ href: null }} />
      <Tabs.Screen name="admin/produtos"              options={{ href: null }} />
      <Tabs.Screen name="admin/funcionarios"          options={{ href: null }} />
      <Tabs.Screen name="admin/promocoes"             options={{ href: null }} />
      <Tabs.Screen name="admin/auditoria"             options={{ href: null }} />
      <Tabs.Screen name="perfil-funcionario/redefinir-senha" options={{ href: null }} />
    </Tabs>
  );
}
