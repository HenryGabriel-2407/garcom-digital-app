import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Modal, TextInput,
  RefreshControl, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../services/api';

// ---------- Tipos ----------
interface ProdutoDetalhe {
  nome: string;
  imagem_link: string;
}

interface ComboDetalhe {
  nome: string;
  imagem_link: string;
}

type ItemDetalhe = ProdutoDetalhe | ComboDetalhe;

interface PedidoItemResponse {
  id: number;
  id_comanda: number;
  id_produto: number | null;
  id_combo: number | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao: string | null;
}

interface ComandaResponse {
  id: number;
  id_mesa: number | null;
  id_garcom: number | null;
  valor_a_pagar: number;
  preco_total: number;
  desconto_aplicado: number;
  taxa_entrega: number;
  troco: number;
  status_comanda: string;
  tipo_entrega: string;
  data_registro: string;
  observacao_geral: string | null;
  mesa_rel?: { numero: number };
  garcom_rel?: { nome: string };
  cliente_rel?: { nome: string };
  metodo_pagamento_rel: { nome: string };
  cod_promocional_rel?: { codigo: string; desconto_percentual: number };
  pedido_itens: PedidoItemResponse[];
}

type DetalheMap = Record<number, ItemDetalhe>;

export default function ComandaScreen() {
  const router = useRouter();
  const { id: mesaId } = useLocalSearchParams<{ id: string }>();

  const [comanda, setComanda] = useState<ComandaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState('');
  const [detalhes, setDetalhes] = useState<DetalheMap>({});

  // Timeline de status
  interface StatusLog {
    id: number;
    status_anterior: string | null;
    status_novo: string;
    alterado_por_tipo: string;
    timestamp: string;
    observacao: string | null;
  }
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const abrirTimeline = async () => {
    if (!comanda) return;
    setLoadingTimeline(true);
    setTimelineVisible(true);
    try {
      const { data } = await api.get<StatusLog[]>(`/comandas/${comanda.id}/status-logs`);
      setStatusLogs(data);
    } catch {
      setStatusLogs([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Modal de edição (quantidade + observação)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PedidoItemResponse | null>(null);
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [novaObservacao, setNovaObservacao] = useState('');

  // Busca detalhes (nome + imagem) de produtos/combos
  const buscarDetalhesDosItens = useCallback(async (itens: PedidoItemResponse[]) => {
    const idsProdutos = itens.filter(i => i.id_produto).map(i => i.id_produto!);
    const idsCombos = itens.filter(i => i.id_combo).map(i => i.id_combo!);
    const novosDetalhes: DetalheMap = {};

    try {
      if (idsProdutos.length > 0) {
        const promises = idsProdutos.map(id =>
          api.get(`/produtos/${id}`).then(res => ({ id, dados: { nome: res.data.nome, imagem_link: res.data.imagem_link } }))
        );
        const resultados = await Promise.all(promises);
        resultados.forEach(p => { novosDetalhes[p.id] = p.dados; });
      }
      if (idsCombos.length > 0) {
        const promises = idsCombos.map(id =>
          api.get(`/combos/${id}`).then(res => ({ id, dados: { nome: res.data.nome, imagem_link: res.data.imagem_link } }))
        );
        const resultados = await Promise.all(promises);
        resultados.forEach(c => { novosDetalhes[c.id] = c.dados; });
      }
      setDetalhes(prev => ({ ...prev, ...novosDetalhes }));
    } catch (error) {
      console.warn('Erro ao buscar detalhes:', error);
    }
  }, []);

  const fetchComanda = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<ComandaResponse[]>('/comandas/', {
        params: { id_mesa: Number(mesaId), limite: 10 },
      });
      const comandaAtiva = data?.find(
        (c) => c.status_comanda !== 'paga' && c.status_comanda !== 'cancelada'
      );
      if (comandaAtiva) {
        setComanda(comandaAtiva);
        await buscarDetalhesDosItens(comandaAtiva.pedido_itens);
      } else {
        setComanda(null);
        setErro('Nenhuma comanda ativa encontrada para esta mesa.');
      }
    } catch (err: any) {
      if (err.response?.status === 401) setErro('Sessão expirada. Faça login novamente.');
      else setErro('Erro ao carregar comanda.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mesaId, buscarDetalhesDosItens]);

  useFocusEffect(useCallback(() => { fetchComanda(); }, [fetchComanda]));

  const refreshComanda = async () => {
    if (!comanda) return;
    try {
      const { data } = await api.get<ComandaResponse>(`/comandas/${comanda.id}`);
      setComanda(data);
      await buscarDetalhesDosItens(data.pedido_itens);
    } catch { /* ignora */ }
  };

  const removerItem = (itemId: number) => {
    Alert.alert('Remover item', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/comandas/itens/${itemId}`);
            await refreshComanda();
          } catch (err: any) {
            Alert.alert('Erro', err.response?.data?.detail || 'Falha ao remover.');
          }
        },
      },
    ]);
  };

  const abrirModalEditar = (item: PedidoItemResponse) => {
    setEditingItem(item);
    setNovaQuantidade(String(item.quantidade));
    setNovaObservacao(item.observacao || '');
    setModalVisible(true);
  };

  const salvarEdicao = async () => {
    if (!editingItem) return;
    const quantidade = parseInt(novaQuantidade, 10);
    if (isNaN(quantidade) || quantidade < 1) {
      Alert.alert('Erro', 'Quantidade inválida.');
      return;
    }
    try {
      await api.put(`/comandas/itens/${editingItem.id}`, {
        quantidade,
        observacao: novaObservacao || null,
      });
      setModalVisible(false);
      await refreshComanda();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Não foi possível atualizar.');
    }
  };

  // Adiciona mais itens – navega para o cardápio passando o comandaId
  const adicionarMaisItens = () => {
    if (!comanda) return;
    router.push({
      pathname: `/(tabs)/mesas/${mesaId}/cardapio`,
      params: { comandaId: comanda.id.toString() }
    });
  };

  const finalizarComanda = async () => {
    if (!comanda) return;
    Alert.alert('Finalizar comanda', 'Marcar como paga e liberar mesa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: async () => {
          try {
            await api.post(`/comandas/${comanda.id}/status`, {
              status_novo: 'paga',
              observacao: 'Finalizada pelo garçom',
            });
            Alert.alert('Sucesso', 'Comanda finalizada!');
            router.replace('/(tabs)/mesas');
          } catch (err: any) {
            Alert.alert('Erro', err.response?.data?.detail || 'Falha ao finalizar.');
          }
        },
      },
    ]);
  };

  const totalReal = comanda?.pedido_itens.reduce((acc, item) => acc + item.subtotal, 0) || 0;

  const renderItem = ({ item }: { item: PedidoItemResponse }) => {
    const idItem = item.id_produto || item.id_combo;
    const detalhe = idItem ? detalhes[idItem] : null;
    const nomeItem = detalhe?.nome || (item.id_produto ? 'Produto' : 'Combo');
    const imagem = detalhe?.imagem_link;

    return (
      <View style={styles.itemCard}>
        {imagem && <Image source={{ uri: imagem }} style={styles.itemImage} resizeMode="cover" />}
        <View style={styles.itemInfo}>
          <Text style={styles.itemNome}>{item.quantidade}x {nomeItem}</Text>
          <Text style={styles.itemPreco}>R$ {item.preco_unitario.toFixed(2)} un.</Text>
          <Text style={styles.itemSubtotal}>Subtotal: R$ {item.subtotal.toFixed(2)}</Text>
          {item.observacao && <Text style={styles.itemObs}>Obs: {item.observacao}</Text>}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => abrirModalEditar(item)} style={styles.actionBtn}>
            <Feather name="edit-2" size={18} color="#8D0000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removerItem(item.id)} style={styles.actionBtn}>
            <Feather name="trash-2" size={18} color="#CC0000" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      </SafeAreaView>
    );
  }

  if (erro || !comanda) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color="#8D0000" />
          <Text style={styles.erroText}>{erro || 'Comanda não encontrada'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
            <Text style={styles.voltarText}>Voltar para mesas</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#8D0000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comanda #{comanda.id}</Text>
        <TouchableOpacity onPress={() => fetchComanda(false)}>
          <Feather name="refresh-cw" size={20} color="#8D0000" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        {comanda.tipo_entrega === 'delivery' ? (
          <Text style={styles.infoText}>Delivery — {comanda.cliente_rel?.nome || 'N/D'}</Text>
        ) : (
          <Text style={styles.infoText}>Mesa: {comanda.mesa_rel?.numero || '—'}</Text>
        )}
        <Text style={styles.infoText}>Garçom: {comanda.garcom_rel?.nome || '—'}</Text>
        <Text style={styles.infoText}>Pagamento: {comanda.metodo_pagamento_rel.nome}</Text>
        <Text style={styles.infoText}>Status: {comanda.status_comanda.toUpperCase()}</Text>
        <Text style={styles.infoText}>Data: {new Date(comanda.data_registro).toLocaleString()}</Text>
        {comanda.cod_promocional_rel && (
          <Text style={styles.infoCupom}>
            Cupom: {comanda.cod_promocional_rel.codigo} ({comanda.cod_promocional_rel.desconto_percentual}% OFF)
          </Text>
        )}
        {comanda.observacao_geral && <Text style={styles.obsGeral}>Obs: {comanda.observacao_geral}</Text>}
        <TouchableOpacity style={styles.timelineBtn} onPress={abrirTimeline}>
          <Feather name="clock" size={14} color="#8D0000" />
          <Text style={styles.timelineBtnText}>Ver histórico de status</Text>
          <Feather name="chevron-right" size={14} color="#8D0000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={comanda.pedido_itens}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.sectionTitle}>ITENS DO PEDIDO</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>Nenhum item nesta comanda.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchComanda(false)} />}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValor}>R$ {totalReal.toFixed(2)}</Text>
        </View>
        {comanda.desconto_aplicado > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.descontoLabel}>Desconto</Text>
            <Text style={styles.descontoValor}>- R$ {comanda.desconto_aplicado.toFixed(2)}</Text>
          </View>
        )}
        {comanda.taxa_entrega > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Taxa de entrega</Text>
            <Text style={styles.totalValor}>R$ {comanda.taxa_entrega.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.totalFinalRow]}>
          <Text style={styles.totalFinalLabel}>VALOR A PAGAR</Text>
          <Text style={styles.totalFinalValor}>R$ {comanda.valor_a_pagar.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={adicionarMaisItens}>
          <Feather name="plus-circle" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>Adicionar mais itens</Text>
        </TouchableOpacity>
        {comanda.status_comanda !== 'paga' && comanda.status_comanda !== 'cancelada' && (
          <TouchableOpacity style={styles.finalizarButton} onPress={finalizarComanda}>
            <Text style={styles.finalizarText}>FINALIZAR COMANDA</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Timeline de status */}
      <Modal visible={timelineVisible} animationType="slide" transparent>
        <View style={styles.timelineOverlay}>
          <View style={styles.timelineContent}>
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineTitle}>Histórico do Pedido</Text>
              <TouchableOpacity onPress={() => setTimelineVisible(false)}>
                <Feather name="x" size={22} color="#555" />
              </TouchableOpacity>
            </View>
            {loadingTimeline ? (
              <ActivityIndicator size="large" color="#8D0000" style={{ marginTop: 40 }} />
            ) : statusLogs.length === 0 ? (
              <Text style={styles.emptyTimeline}>Nenhum registro de status encontrado.</Text>
            ) : (
              <ScrollView style={styles.timelineList}>
                {statusLogs.map((log, idx) => {
                  const isLast = idx === statusLogs.length - 1;
                  const getStatusLabel = (s: string | null) => {
                    const map: Record<string, string> = {
                      aberta: 'Aberta',
                      em_preparo: 'Em Preparo',
                      pronta: 'Pronta',
                      entregue: 'Entregue',
                      paga: 'Paga',
                      cancelada: 'Cancelada',
                    };
                    return s ? (map[s] || s) : '—';
                  };
                  const getStatusColor = (s: string | null) => {
                    const map: Record<string, string> = {
                      aberta: '#8D0000',
                      em_preparo: '#E68A00',
                      pronta: '#2A6B2A',
                      entregue: '#2A3406',
                      paga: '#555',
                      cancelada: '#999',
                    };
                    return s ? (map[s] || '#555') : '#555';
                  };
                  return (
                    <View key={log.id} style={styles.timelineItem}>
                      <View style={styles.timelineMarker}>
                        <View style={[styles.timelineDot, { backgroundColor: getStatusColor(log.status_novo) }]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineEvent}>
                        <Text style={[styles.timelineStatus, { color: getStatusColor(log.status_novo) }]}>
                          {getStatusLabel(log.status_anterior)} → {getStatusLabel(log.status_novo)}
                        </Text>
                        <Text style={styles.timelineTime}>
                          {new Date(log.timestamp).toLocaleString()}
                        </Text>
                        {log.observacao && (
                          <Text style={styles.timelineObs}>{log.observacao}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar item</Text>
            <Text style={styles.modalLabel}>Quantidade</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={novaQuantidade}
              onChangeText={setNovaQuantidade}
            />
            <Text style={styles.modalLabel}>Observação (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              multiline
              value={novaObservacao}
              onChangeText={setNovaObservacao}
              placeholder="Ex.: Sem cebola, bem passado..."
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={salvarEdicao} style={styles.modalBtnSave}>
                <Text style={styles.modalBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  erroText: { fontSize: 16, color: '#8D0000', marginTop: 12, textAlign: 'center' },
  voltarBtn: { marginTop: 20, backgroundColor: '#8D0000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30 },
  voltarText: { color: '#FFF', fontWeight: 'bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  infoBox: { backgroundColor: '#FFF', margin: 16, padding: 14, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  infoText: { fontSize: 14, color: '#333', marginBottom: 4 },
  obsGeral: { fontSize: 13, color: '#666', marginTop: 8, fontStyle: 'italic' },
  infoCupom: { fontSize: 13, color: '#2A6B2A', marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#555', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  itemCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 10, alignItems: 'center' },
  itemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemNome: { fontSize: 15, fontWeight: '600', color: '#333' },
  itemPreco: { fontSize: 13, color: '#666', marginTop: 2 },
  itemSubtotal: { fontSize: 13, fontWeight: '700', color: '#8D0000', marginTop: 4 },
  itemObs: { fontSize: 12, color: '#888', marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 8 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  footer: { borderTopWidth: 1, borderTopColor: '#EEE', padding: 16, backgroundColor: '#FDF5E6' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: 14, color: '#555' },
  totalValor: { fontSize: 14, color: '#333', fontWeight: '600' },
  descontoLabel: { fontSize: 14, color: '#2A6B2A', fontWeight: '600' },
  descontoValor: { fontSize: 14, color: '#2A6B2A', fontWeight: 'bold' },
  totalFinalRow: { borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10, marginTop: 6, marginBottom: 16 },
  totalFinalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  totalFinalValor: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  addButton: { backgroundColor: '#8D0000', borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8, marginBottom: 12 },
  addButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  finalizarButton: { backgroundColor: '#2A6B2A', borderRadius: 30, paddingVertical: 12, alignItems: 'center' },
  finalizarText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  timelineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  timelineBtnText: { color: '#8D0000', fontSize: 13, fontWeight: '600', flex: 1 },

  timelineOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  timelineContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  timelineTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  timelineList: { maxHeight: 400 },
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineMarker: { alignItems: 'center', width: 24, marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#DDD', marginVertical: 2 },
  timelineEvent: { flex: 1, paddingBottom: 16 },
  timelineStatus: { fontSize: 15, fontWeight: '700' },
  timelineTime: { fontSize: 12, color: '#888', marginTop: 2 },
  timelineObs: { fontSize: 12, color: '#666', marginTop: 2, fontStyle: 'italic' },
  emptyTimeline: { textAlign: 'center', color: '#999', paddingVertical: 40 },

  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtnCancel: { backgroundColor: '#CCC', padding: 10, borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' },
  modalBtnSave: { backgroundColor: '#8D0000', padding: 10, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },
});