import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';

interface AdminCard {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  color: string;
  desc: string;
}

const CARDS: AdminCard[] = [
  { title: 'Clientes', icon: 'users', route: '/(tabs)/admin/clientes', color: '#2A6B2A', desc: 'Gerenciar clientes cadastrados' },
  { title: 'Mesas', icon: 'grid', route: '/(tabs)/admin/mesas', color: '#8D0000', desc: 'Gerenciar mesas do salão' },
  { title: 'Produtos', icon: 'shopping-bag', route: '/(tabs)/admin/produtos', color: '#E68A00', desc: 'Gerenciar cardápio' },
  { title: 'Funcionários', icon: 'user-check', route: '/(tabs)/admin/funcionarios', color: '#7B5800', desc: 'Gerenciar equipe' },
  { title: 'Promoções', icon: 'tag', route: '/(tabs)/admin/promocoes', color: '#2A3406', desc: 'Cupons e descontos' },
  { title: 'Auditoria', icon: 'file-text', route: '/(tabs)/admin/auditoria', color: '#555', desc: 'Logs de auditoria' },
];

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Feather name="shield" size={22} color="#8D0000" />
        <Text style={styles.headerTitle}>ADMIN</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.welcome}>
        Bem-vindo, {user?.nome?.split(' ')[0]}
      </Text>
      <Text style={styles.subtitle}>
        {user?.cargo === 'admin' ? 'Administrador' : 'Gerente'} — Gerencie o sistema
      </Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {CARDS.map((card) => (
          <TouchableOpacity
            key={card.route}
            style={styles.card}
            onPress={() => router.push(card.route as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconBox, { backgroundColor: card.color + '15' }]}>
              <Feather name={card.icon} size={28} color={card.color} />
            </View>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.desc}</Text>
            <Feather name="chevron-right" size={18} color="#CCC" style={{ marginTop: 8 }} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#333', paddingHorizontal: 20 },
  subtitle: { fontSize: 13, color: '#888', paddingHorizontal: 20, marginBottom: 20 },

  grid: { paddingHorizontal: 16, paddingBottom: 32, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#888', lineHeight: 15 },
});
