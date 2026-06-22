import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface DeliveryComanda {
  id: number;
  id_cliente?: number | null;
  valor_a_pagar: number;
  preco_total: number;
  status_comanda: string;
  status_pagamento: string;
  tipo_entrega: string;
  data_registro: string;
  observacao_geral?: string | null;
  cliente_rel?: { nome: string } | null;
  garcom_rel?: { nome: string } | null;
  mesa_rel?: { numero: number } | null;
  id_mesa?: number | null;
  pedido_itens: { id: number; quantidade: number; subtotal: number }[];
}

const STATUS_CORES: Record<string, string> = {
  aberta: '#8D0000',
  em_preparo: '#E68A00',
  pronta: '#2A6B2A',
  entregue: '#2A3406',
  paga: '#555',
  cancelada: '#999',
};

export default function OnlineScreen() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<DeliveryComanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');

  const fetchPedidos = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErro('');
    try {
      const params: Record<string, any> = { origem: 'web' };
      if (filtroStatus) params.status_comanda = filtroStatus;
      const { data } = await api.get<DeliveryComanda[]>('/comandas/', { params });
      setPedidos(data);
    } catch {
      setErro('Não foi possível carregar pedidos online.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtroStatus]);

  useFocusEffect(useCallback(() => { fetchPedidos(); }, [fetchPedidos]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchPedidos(false);
  };

  const statusFiltros = [
    { label: 'TODOS', value: '' },
    { label: 'ABERTA', value: 'aberta' },
    { label: 'EM PREPARO', value: 'em_preparo' },
    { label: 'PRONTA', value: 'pronta' },
    { label: 'ENTREGUE', value: 'entregue' },
  ];

  const formatStatus = (s: string) =>
    s === 'em_preparo' ? 'EM PREPARO' : s.toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#8D0000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PEDIDOS ONLINE</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/mesas/novo-pedido-delivery')}
          style={styles.novoBtn}
        >
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={styles.novoBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtrosRow}>
        <FlatList
          horizontal
          data={statusFiltros}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filtro, filtroStatus === item.value && styles.filtroActive]}
              onPress={() => setFiltroStatus(item.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filtroText, filtroStatus === item.value && styles.filtroTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8D0000" />
        </View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={styles.erroText}>{erro}</Text>
          <TouchableOpacity onPress={() => fetchPedidos()} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const cor = STATUS_CORES[item.status_comanda] || '#999';
            const qtdItens = item.pedido_itens.reduce((s, i) => s + i.quantidade, 0);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: `/(tabs)/mesas/[id]/comanda`,
                    params: { id: String(item.id_mesa || '0') },
                  })
                }
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.pedidoId}>Pedido #{item.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: cor + '20' }]}>
                    <Text style={[styles.statusText, { color: cor }]}>{formatStatus(item.status_comanda)}</Text>
                  </View>
                </View>

                <Text style={styles.clienteNome}>
                  {item.cliente_rel?.nome || 'Cliente não identificado'}
                </Text>

                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>{qtdItens} itens</Text>
                  <Text style={styles.metaText}>
                    {new Date(item.data_registro).toLocaleString()}
                  </Text>
                </View>

                <Text style={styles.totalText}>
                  R$ {item.valor_a_pagar.toFixed(2).replace('.', ',')}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8D0000" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="shopping-bag" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhum pedido online encontrado.</Text>
            </View>
          }
        />
      )}
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
  novoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#8D0000',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  novoBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  filtrosRow: { marginBottom: 8 },
  filtro: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#EDE0CC',
  },
  filtroActive: { backgroundColor: '#8D0000' },
  filtroText: { fontSize: 12, fontWeight: '600', color: '#555' },
  filtroTextActive: { color: '#FFF' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pedidoId: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  clienteNome: { fontSize: 14, color: '#555', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metaText: { fontSize: 12, color: '#888' },
  totalText: { fontSize: 17, fontWeight: 'bold', color: '#8D0000' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  erroText: { color: '#8D0000', fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#8D0000', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#FFF', fontWeight: 'bold' },
  emptyText: { fontSize: 15, color: '#999', marginTop: 12 },
});
