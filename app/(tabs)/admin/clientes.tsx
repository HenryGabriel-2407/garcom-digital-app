import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  documento?: string;
  ativo: boolean;
  data_cadastro: string;
}

export default function AdminClientesScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  const fetchClientes = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: Record<string, any> = { limite: 100 };
      if (busca.trim()) params.busca = busca.trim();
      const { data } = await api.get<Cliente[]>('/clientes/', { params });
      setClientes(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [busca]);

  useFocusEffect(useCallback(() => { fetchClientes(); }, [fetchClientes]));

  const toggleAtivo = (cliente: Cliente) => {
    const acao = cliente.ativo ? 'desativar' : 'ativar';
    Alert.alert(`${acao === 'ativar' ? 'Ativar' : 'Desativar'} cliente`, `Tem certeza?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim',
        onPress: async () => {
          try {
            await api.post(`/clientes/${cliente.id}/${acao}`);
            fetchClientes(false);
          } catch {
            Alert.alert('Erro', `Falha ao ${acao} cliente.`);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clientes</Text>
        <Text style={styles.headerCount}>{clientes.length}</Text>
      </View>

      <View style={styles.buscaBox}>
        <Feather name="search" size={16} color="#999" />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por nome ou email..."
          placeholderTextColor="#BBB"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Feather name="x" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardNome}>{item.nome}</Text>
                  <Text style={styles.cardEmail}>{item.email}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleAtivo(item)}>
                  <Feather
                    name={item.ativo ? 'toggle-left' : 'toggle-right'}
                    size={28}
                    color={item.ativo ? '#2A6B2A' : '#CCC'}
                  />
                </TouchableOpacity>
              </View>
              {item.telefone && <Text style={styles.cardMeta}>📞 {item.telefone}</Text>}
              <Text style={styles.cardMeta}>📅 {new Date(item.data_cadastro).toLocaleDateString()}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClientes(false); }} />}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>Nenhum cliente encontrado.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  headerCount: { fontSize: 14, color: '#888', backgroundColor: '#EDE0CC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  buscaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 14, height: 44, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  buscaInput: { flex: 1, fontSize: 14, color: '#333', marginLeft: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8D0000', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 15, fontWeight: '600', color: '#333' },
  cardEmail: { fontSize: 13, color: '#888' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4, marginLeft: 52 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },
});
