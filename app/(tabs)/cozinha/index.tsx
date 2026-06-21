import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface PedidoItem {
  id: number;
  id_produto: number | null;
  id_combo: number | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao: string | null;
}

interface Comanda {
  id: number;
  id_mesa: number | null;
  id_cliente: number | null;
  valor_a_pagar: number;
  status_comanda: string;
  data_registro: string;
  observacao_geral: string | null;
  tipo_entrega: string;
  mesa_rel?: { numero: number } | null;
  cliente_rel?: { nome: string } | null;
  garcom_rel?: { nome: string } | null;
  pedido_itens: PedidoItem[];
}

type FiltroCozinha = 'pendentes' | 'em_preparo' | 'prontas';

const FILTROS: { label: string; value: FiltroCozinha; status: string }[] = [
  { label: 'PENDENTES', value: 'pendentes', status: 'aberta' },
  { label: 'EM PREPARO', value: 'em_preparo', status: 'em_preparo' },
  { label: 'PRONTAS', value: 'prontas', status: 'pronta' },
];

export default function CozinhaScreen() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<FiltroCozinha>('pendentes');
  const [erro, setErro] = useState('');

  const fetchComandas = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErro('');
    try {
      const filtroAtual = FILTROS.find((f) => f.value === filtro)!;
      const { data } = await api.get<Comanda[]>('/comandas/', {
        params: { status_comanda: filtroAtual.status },
      });
      setComandas(data);
    } catch {
      setErro('Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  useFocusEffect(useCallback(() => { fetchComandas(); }, [fetchComandas]));

  const atualizarStatus = async (comandaId: number, novoStatus: string) => {
    try {
      await api.post(`/comandas/${comandaId}/status`, { status_novo: novoStatus });
      fetchComandas(false);
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao atualizar status.');
    }
  };

  const confirmarAcao = (comandaId: number, acao: string, label: string) => {
    Alert.alert(
      `Confirmar`,
      `Marcar como "${label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim', onPress: () => atualizarStatus(comandaId, acao) },
      ]
    );
  };

  const formatStatus = (s: string) => {
    const map: Record<string, string> = {
      aberta: 'PENDENTE',
      em_preparo: 'EM PREPARO',
      pronta: 'PRONTA',
    };
    return map[s] || s.toUpperCase();
  };

  const statusCor = (s: string) => {
    const map: Record<string, string> = {
      aberta: '#8D0000',
      em_preparo: '#E68A00',
      pronta: '#2A6B2A',
    };
    return map[s] || '#555';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Feather name="clock" size={22} color="#8D0000" />
        <Text style={styles.headerTitle}>PAINEL DA COZINHA</Text>
        <Feather name="refresh-cw" size={20} color="#8D0000" onPress={() => fetchComandas()} />
      </View>

      <View style={styles.filtrosRow}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filtro, filtro === f.value && styles.filtroActive]}
            onPress={() => setFiltro(f.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filtroText, filtro === f.value && styles.filtroTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8D0000" />
        </View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={styles.erroText}>{erro}</Text>
          <TouchableOpacity onPress={() => fetchComandas()} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={comandas}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const origemIcon = item.tipo_entrega === 'delivery' ? 'truck' : 'grid';
            const origemLabel = item.tipo_entrega === 'delivery'
              ? `Delivery - ${item.cliente_rel?.nome || 'N/D'}`
              : `Mesa ${item.mesa_rel?.numero || 'N/D'}`;
            const garcomNome = item.garcom_rel?.nome?.split(' ')[0] || 'N/D';

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Feather name={origemIcon} size={16} color="#8D0000" />
                    <Text style={styles.cardTitle}>Pedido #{item.id}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusCor(item.status_comanda) + '20' }]}>
                    <Text style={[styles.statusText, { color: statusCor(item.status_comanda) }]}>
                      {formatStatus(item.status_comanda)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Feather name="map-pin" size={13} color="#888" />
                  <Text style={styles.infoText}>{origemLabel}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="user" size={13} color="#888" />
                  <Text style={styles.infoText}>Garçom: {garcomNome}</Text>
                </View>

                <View style={styles.itensBox}>
                  {item.pedido_itens.map((pi) => (
                    <View key={pi.id} style={styles.itemRow}>
                      <Text style={styles.itemQtd}>{pi.quantidade}x</Text>
                      <Text style={styles.itemInfoText}>
                        {pi.id_produto ? 'Produto' : 'Combo'} #{pi.id_produto || pi.id_combo}
                      </Text>
                      {pi.observacao && (
                        <Text style={styles.itemObs}>Obs: {pi.observacao}</Text>
                      )}
                    </View>
                  ))}
                </View>

                <Text style={styles.tempoText}>
                  {new Date(item.data_registro).toLocaleTimeString()}
                </Text>

                {/* Ações */}
                {item.status_comanda === 'aberta' && (
                  <TouchableOpacity
                    style={styles.acaoBtn}
                    onPress={() => confirmarAcao(item.id, 'em_preparo', 'Em Preparo')}
                  >
                    <Feather name="play" size={16} color="#FFF" />
                    <Text style={styles.acaoBtnText}>INICIAR PREPARO</Text>
                  </TouchableOpacity>
                )}
                {item.status_comanda === 'em_preparo' && (
                  <TouchableOpacity
                    style={[styles.acaoBtn, { backgroundColor: '#2A6B2A' }]}
                    onPress={() => confirmarAcao(item.id, 'pronta', 'Pronta')}
                  >
                    <Feather name="check" size={16} color="#FFF" />
                    <Text style={styles.acaoBtnText}>MARCAR COMO PRONTA</Text>
                  </TouchableOpacity>
                )}
                {item.status_comanda === 'pronta' && (
                  <View style={styles.prontaInfo}>
                    <Feather name="check-circle" size={16} color="#2A6B2A" />
                    <Text style={styles.prontaTexto}>Pedido pronto para entrega</Text>
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchComandas(false); }} tintColor="#8D0000" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="coffee" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhum pedido neste filtro.</Text>
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
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#8D0000' },

  filtrosRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
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
    marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: '#555' },

  itensBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  itemRow: { paddingVertical: 3 },
  itemQtd: { fontSize: 14, fontWeight: '700', color: '#8D0000' },
  itemInfoText: { fontSize: 13, color: '#333' },
  itemObs: { fontSize: 12, color: '#888', fontStyle: 'italic', marginLeft: 24 },

  tempoText: { fontSize: 12, color: '#999', textAlign: 'right', marginBottom: 10 },

  acaoBtn: {
    backgroundColor: '#E68A00',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acaoBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

  prontaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  prontaTexto: { color: '#2A6B2A', fontWeight: '600', fontSize: 13 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  erroText: { color: '#8D0000', fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#8D0000', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#FFF', fontWeight: 'bold' },
  emptyText: { fontSize: 15, color: '#999', marginTop: 12 },
});
