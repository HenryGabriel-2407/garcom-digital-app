// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function TabsLayout() {
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
        name="mesas/index"
        options={{
          title: 'Mesas',
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil-funcionario/index"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />

      {/* Esconde todas as rotas filhas da tab bar */}
      <Tabs.Screen name="mesas/[id]/nova-comanda"           options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/cardapio"               options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/comanda"                options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/confirmar-chegada"      options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/produto/[produtoId]"    options={{ href: null }} />
      <Tabs.Screen name="mesas/[id]/combo/[comboId]"        options={{ href: null }} />
      <Tabs.Screen name="perfil-funcionario/redefinir-senha" options={{ href: null }} />
    </Tabs>
  );
}