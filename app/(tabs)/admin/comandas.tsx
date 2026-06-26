import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import api from '../../../services/api';

interface ProdutoDetalhe { nome: string; imagem_link?: string }
interface ComboDetalhe { nome: string; imagem_link?: string }
type ItemDetalhe = ProdutoDetalhe | ComboDetalhe;

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
  id_garcom: number | null;
  valor_a_pagar: number;
  preco_total: number;
  desconto_aplicado: number;
  taxa_entrega: number;
  troco: number;
  status_comanda: string;
  tipo_entrega: string;
  data_registro: string;
  data_finalizacao: string | null;
  observacao_geral: string | null;
  mesa_rel?: { numero: number } | null;
  cliente_rel?: { nome: string; email?: string } | null;
  garcom_rel?: { nome: string } | null;
  metodo_pagamento_rel?: { nome: string } | null;
  cod_promocional_rel?: { codigo: string; desconto_percentual: number } | null;
  pedido_itens: PedidoItem[];
}

const STATUS_LIST = [
  { value: '', label: 'Todos' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_preparo', label: 'Em Preparo' },
  { value: 'pronta', label: 'Pronta' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'paga', label: 'Paga' },
];

const STATUS_COLORS: Record<string, string> = {
  aberta: '#E68A00',
  em_preparo: '#8D0000',
  pronta: '#2A6B2A',
  entregue: '#2A6B2A',
  cancelada: '#CC0000',
  paga: '#555',
};

const getStatusLabel = (s: string) => {
  const found = STATUS_LIST.find((x) => x.value === s);
  return found ? found.label : s;
};

const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const nomeClienteComanda = (c: Comanda) =>
  c.cliente_rel?.nome || (c.observacao_geral?.startsWith('Cliente: ') ? c.observacao_geral.slice(9) : null);

export default function AdminComandasScreen() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [dataInicio, setDataInicio] = useState<Date | null>(null);
  const [dataFim, setDataFim] = useState<Date | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPicker, setShowPicker] = useState<'inicio' | 'fim' | null>(null);

  const [detalhes, setDetalhes] = useState<Record<number, ItemDetalhe>>({});

  const [reciboVisible, setReciboVisible] = useState(false);
  const [reciboComanda, setReciboComanda] = useState<Comanda | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const buscarDetalhesDosItens = useCallback(async (itens: PedidoItem[]) => {
    const idsProdutos = itens.filter(i => i.id_produto).map(i => i.id_produto!);
    const idsCombos = itens.filter(i => i.id_combo).map(i => i.id_combo!);
    const novosDetalhes: Record<number, ItemDetalhe> = {};
    try {
      if (idsProdutos.length > 0) {
        const results = await Promise.all(idsProdutos.map(id =>
          api.get(`/produtos/${id}`).then(r => ({ id, dados: { nome: r.data.nome, imagem_link: r.data.imagem_link } }))
        ));
        results.forEach(p => { novosDetalhes[p.id] = p.dados; });
      }
      if (idsCombos.length > 0) {
        const results = await Promise.all(idsCombos.map(id =>
          api.get(`/combos/${id}`).then(r => ({ id, dados: { nome: r.data.nome, imagem_link: r.data.imagem_link } }))
        ));
        results.forEach(c => { novosDetalhes[c.id] = c.dados; });
      }
      setDetalhes(prev => ({ ...prev, ...novosDetalhes }));
    } catch { /* ignora */ }
  }, []);

  const fetchComandas = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: Record<string, any> = { limite: 100 };
      if (statusFilter) params.status_comanda = statusFilter;
      if (dataInicio) params.data_inicio = formatDate(dataInicio);
      if (dataFim) params.data_fim = formatDate(dataFim);
      const { data } = await api.get<Comanda[]>('/comandas/', { params });
      setComandas(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, dataInicio, dataFim]);

  useFocusEffect(useCallback(() => { fetchComandas(); }, [fetchComandas]));

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    const picker = showPicker;
    setShowPicker(null);
    if (!selectedDate) return;
    if (picker === 'inicio') setDataInicio(selectedDate);
    else setDataFim(selectedDate);
  };

  const abrirRecibo = async (comanda: Comanda) => {
    try {
      const { data } = await api.get<Comanda>(`/comandas/${comanda.id}`);
      setReciboComanda(data);
      await buscarDetalhesDosItens(data.pedido_itens);
      setReciboVisible(true);
    } catch {
      setReciboComanda(comanda);
      await buscarDetalhesDosItens(comanda.pedido_itens);
      setReciboVisible(true);
    }
  };

  const gerarHtmlRecibo = (c: Comanda): string => {
    const itensHtml = c.pedido_itens.map(item => {
      const idItem = item.id_produto || item.id_combo;
      const detalhe = idItem ? detalhes[idItem] : null;
      return `
        <tr>
          <td style="text-align:center">${item.quantidade}x</td>
          <td>${detalhe?.nome || 'XXXX'}</td>
          <td style="text-align:right">R$ ${item.preco_unitario.toFixed(2)}</td>
          <td style="text-align:right">R$ ${item.subtotal.toFixed(2)}</td>
        </tr>`;
    }).join('');

    return `
      <html>
      <head><meta charset="utf-8"><title>Recibo #${c.id}</title>
      <style>
        body { font-family: monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
        h1 { text-align: center; font-size: 18px; }
        h2 { text-align: center; font-size: 14px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th { border-bottom: 2px solid #333; padding: 6px 4px; text-align: left; }
        td { border-bottom: 1px solid #DDD; padding: 6px 4px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
        .line { border-top: 1px dashed #333; margin: 12px 0; }
      </style></head>
      <body>
        <h1>RECIBO</h1>
        <h2>Comanda #${c.id}</h2>
        <div class="line"></div>
        <p><b>Mesa:</b> ${c.mesa_rel?.numero ?? 'XXXX'}</p>
        <p><b>Garçom:</b> ${c.garcom_rel?.nome ?? 'XXXX'}</p>
        <p><b>Cliente:</b> ${nomeClienteComanda(c) || 'XXXX'}</p>
        <p><b>Pagamento:</b> ${c.metodo_pagamento_rel?.nome ?? 'XXXX'}</p>
        <p><b>Data:</b> ${new Date(c.data_registro).toLocaleString()}</p>
        <div class="line"></div>
        <table>
          <tr><th>Qtd</th><th>Item</th><th>Valor</th><th>Subtotal</th></tr>
          ${itensHtml}
        </table>
        <div class="line"></div>
        <p><b>Subtotal:</b> R$ ${c.preco_total.toFixed(2)}</p>
        ${c.desconto_aplicado > 0 ? `<p><b>Desconto:</b> -R$ ${c.desconto_aplicado.toFixed(2)}</p>` : ''}
        ${c.taxa_entrega > 0 ? `<p><b>Taxa entrega:</b> R$ ${c.taxa_entrega.toFixed(2)}</p>` : ''}
        <p style="font-size:16px"><b>VALOR A PAGAR: R$ ${c.valor_a_pagar.toFixed(2)}</b></p>
        <div class="line"></div>
        <p><b>Troco:</b> R$ ${c.troco > 0 ? c.troco.toFixed(2) : 'XXXX'}</p>
        ${c.cod_promocional_rel ? `<p><b>Cupom:</b> ${c.cod_promocional_rel.codigo} (${c.cod_promocional_rel.desconto_percentual}% OFF)</p>` : ''}
        <div class="footer">
          <p>Obrigado pela preferência!</p>
          <p>Pizzaria Forno di Resistenza</p>
        </div>
      </body></html>`;
  };

  const baixarPdf = async () => {
    if (!reciboComanda) return;
    setGerandoPdf(true);
    try {
      const html = gerarHtmlRecibo(reciboComanda);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Recibo #${reciboComanda.id}` });
      } else {
        Alert.alert('PDF salvo', `Arquivo: ${uri}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally { setGerandoPdf(false); }
  };

  const enviarEmail = async () => {
    if (!reciboComanda) return;
    try {
      await api.post(`/comandas/${reciboComanda.id}/enviar-recibo`);
      Alert.alert('Sucesso', 'Recibo enviado por e-mail.');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao enviar e-mail.';
      Alert.alert('Erro', msg);
    }
  };

  const formatCurrency = (v: number) =>
    `R$ ${v.toFixed(2).replace('.', ',')}`;

  const itemCount = (c: Comanda) =>
    c.pedido_itens?.reduce((acc, i) => acc + i.quantidade, 0) || 0;

  const statusLabel = statusFilter ? getStatusLabel(statusFilter) : 'Status';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comandas</Text>
        <TouchableOpacity onPress={() => fetchComandas()}>
          <Feather name="refresh-cw" size={20} color="#8D0000" />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.dateGroup}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker('inicio')}>
            <Feather name="calendar" size={16} color="#888" />
            <Text style={[styles.dateText, !dataInicio && styles.datePlaceholder]}>
              {dataInicio ? formatDate(dataInicio) : 'Início'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker('fim')}>
            <Feather name="calendar" size={16} color="#888" />
            <Text style={[styles.dateText, !dataFim && styles.datePlaceholder]}>
              {dataFim ? formatDate(dataFim) : 'Fim'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.statusButton}
          onPress={() => setShowStatusPicker(true)}
        >
          <Text style={[styles.statusButtonText, !!statusFilter && { color: '#333', fontWeight: '600' }]}>
            {statusLabel}
          </Text>
          <Feather name="chevron-down" size={16} color="#555" />
        </TouchableOpacity>
      </View>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={showPicker === 'inicio' ? dataInicio ?? new Date() : dataFim ?? new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      <Modal visible={showPicker !== null && Platform.OS === 'ios'} transparent animationType="fade" onRequestClose={() => setShowPicker(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(null)}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <TouchableOpacity onPress={() => setShowPicker(null)}>
                <Text style={styles.pickerDoneText}>Concluir</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={showPicker === 'inicio' ? dataInicio ?? new Date() : dataFim ?? new Date()}
              mode="date"
              display="spinner"
              onChange={onDateChange}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtrar por status</Text>
            {STATUS_LIST.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.modalOption, statusFilter === s.value && styles.modalOptionActive]}
                onPress={() => { setStatusFilter(s.value); setShowStatusPicker(false); }}
              >
                <Text style={[styles.modalOptionText, statusFilter === s.value && styles.modalOptionTextActive]}>
                  {s.label}
                </Text>
                {statusFilter === s.value && <Feather name="check" size={18} color="#8D0000" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={comandas}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => abrirRecibo(item)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.cardId}>#{item.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status_comanda] || '#555') + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status_comanda] || '#555' }]}>
                    {getStatusLabel(item.status_comanda).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.cardTipo}>{item.tipo_entrega === 'delivery' ? '🛵' : '🍽️'}</Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardInfo}>
                  <Text style={styles.infoLabel}>Mesa</Text>
                  <Text style={styles.infoValue}>{item.mesa_rel?.numero ?? '—'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.infoLabel}>Itens</Text>
                  <Text style={styles.infoValue}>{itemCount(item)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.infoLabel}>Valor</Text>
                  <Text style={styles.infoValue}>{formatCurrency(item.valor_a_pagar)}</Text>
                </View>
              </View>

              <View style={styles.cardMeta}>
                {nomeClienteComanda(item) && <Text style={styles.metaText}>👤 {nomeClienteComanda(item)}</Text>}
                {item.garcom_rel && <Text style={styles.metaText}>👨‍🍳 {item.garcom_rel.nome}</Text>}
                <Text style={styles.metaText}>🕐 {new Date(item.data_registro).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchComandas(false); }} tintColor="#8D0000" />}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>Nenhuma comanda encontrada.</Text></View>}
        />
      )}

      <Modal visible={reciboVisible} animationType="slide" transparent onRequestClose={() => setReciboVisible(false)}>
        <View style={styles.reciboOverlay}>
          <View style={styles.reciboContent}>
            <View style={styles.reciboHeader}>
              <Text style={styles.reciboTitle}>RECIBO</Text>
              <TouchableOpacity onPress={() => setReciboVisible(false)}>
                <Feather name="x" size={22} color="#555" />
              </TouchableOpacity>
            </View>
            {reciboComanda && (
              <>
                <View style={styles.reciboBody}>
                  <Text style={styles.reciboSubtitle}>Comanda #{reciboComanda.id}</Text>
                  <View style={styles.divisor} />
                  <View style={styles.reciboInfoRow}>
                    <Text style={styles.reciboLabel}>Mesa:</Text>
                    <Text style={styles.reciboValue}>{reciboComanda.mesa_rel?.numero ?? 'XXXX'}</Text>
                  </View>
                  <View style={styles.reciboInfoRow}>
                    <Text style={styles.reciboLabel}>Garçom:</Text>
                    <Text style={styles.reciboValue}>{reciboComanda.garcom_rel?.nome ?? 'XXXX'}</Text>
                  </View>
                  <View style={styles.reciboInfoRow}>
                    <Text style={styles.reciboLabel}>Cliente:</Text>
                    <Text style={styles.reciboValue}>{nomeClienteComanda(reciboComanda) || 'XXXX'}</Text>
                  </View>
                  <View style={styles.reciboInfoRow}>
                    <Text style={styles.reciboLabel}>Pagamento:</Text>
                    <Text style={styles.reciboValue}>{reciboComanda.metodo_pagamento_rel?.nome ?? 'XXXX'}</Text>
                  </View>
                  <View style={styles.reciboInfoRow}>
                    <Text style={styles.reciboLabel}>Data:</Text>
                    <Text style={styles.reciboValue}>{new Date(reciboComanda.data_registro).toLocaleString()}</Text>
                  </View>

                  <View style={styles.divisor} />
                  <Text style={styles.reciboSecTitle}>ITENS</Text>
                  {reciboComanda.pedido_itens.map(item => {
                    const idItem = item.id_produto || item.id_combo;
                    const detalhe = idItem ? detalhes[idItem] : null;
                    return (
                      <View key={item.id} style={styles.reciboItemRow}>
                        <Text style={styles.reciboItemQtd}>{item.quantidade}x</Text>
                        <Text style={styles.reciboItemNome}>{detalhe?.nome || 'XXXX'}</Text>
                        <Text style={styles.reciboItemValor}>R$ {item.subtotal.toFixed(2)}</Text>
                      </View>
                    );
                  })}

                  <View style={styles.divisor} />
                  <View style={styles.reciboTotalRow}>
                    <Text style={styles.reciboTotalLabel}>Subtotal</Text>
                    <Text style={styles.reciboTotalValor}>R$ {reciboComanda.preco_total.toFixed(2)}</Text>
                  </View>
                  {reciboComanda.desconto_aplicado > 0 && (
                    <View style={styles.reciboTotalRow}>
                      <Text style={[styles.reciboTotalLabel, { color: '#2A6B2A' }]}>Desconto</Text>
                      <Text style={[styles.reciboTotalValor, { color: '#2A6B2A' }]}>- R$ {reciboComanda.desconto_aplicado.toFixed(2)}</Text>
                    </View>
                  )}
                  {reciboComanda.taxa_entrega > 0 && (
                    <View style={styles.reciboTotalRow}>
                      <Text style={styles.reciboTotalLabel}>Taxa entrega</Text>
                      <Text style={styles.reciboTotalValor}>R$ {reciboComanda.taxa_entrega.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.reciboTotalRow, { borderTopWidth: 2, borderTopColor: '#333', paddingTop: 8, marginTop: 8 }]}>
                    <Text style={[styles.reciboTotalLabel, { fontSize: 16 }]}>VALOR A PAGAR</Text>
                    <Text style={[styles.reciboTotalValor, { fontSize: 16, color: '#8D0000' }]}>R$ {reciboComanda.valor_a_pagar.toFixed(2)}</Text>
                  </View>
                  <View style={styles.reciboInfoRow}>
                    <Text style={styles.reciboLabel}>Troco:</Text>
                    <Text style={styles.reciboValue}>R$ {reciboComanda.troco > 0 ? reciboComanda.troco.toFixed(2) : 'XXXX'}</Text>
                  </View>
                </View>

                <View style={styles.reciboActions}>
                  <TouchableOpacity style={styles.reciboActionBtn} onPress={baixarPdf} disabled={gerandoPdf}>
                    {gerandoPdf ? <ActivityIndicator size="small" color="#FFF" /> : (
                      <><Feather name="download" size={18} color="#FFF" /><Text style={styles.reciboActionText}>Baixar PDF</Text></>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.reciboActionBtn, { backgroundColor: '#2A6B2A' }]} onPress={enviarEmail}>
                    <Feather name="mail" size={18} color="#FFF" />
                    <Text style={styles.reciboActionText}>Enviar E-mail</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },

  filtersRow: { paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  dateGroup: { flexDirection: 'row', gap: 8 },
  dateButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: '#EEE',
  },
  dateText: { fontSize: 13, color: '#333', flex: 1 },
  datePlaceholder: { color: '#BBB' },
  statusButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: '#EEE',
  },
  statusButtonText: { fontSize: 14, color: '#555', flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, width: '80%', maxWidth: 320 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  modalOptionActive: { backgroundColor: '#8D0000' + '08' },
  modalOptionText: { fontSize: 15, color: '#333' },
  modalOptionTextActive: { color: '#8D0000', fontWeight: '600' },

  pickerModalContent: { backgroundColor: '#FFF', borderRadius: 16, paddingBottom: 20, width: '80%', maxWidth: 360 },
  pickerModalHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  pickerDoneText: { fontSize: 15, fontWeight: '600', color: '#8D0000' },

  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardId: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardTipo: { marginLeft: 'auto' },
  cardBody: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  cardInfo: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#AAA', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  cardMeta: { gap: 2, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  metaText: { fontSize: 12, color: '#888' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },

  reciboOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  reciboContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  reciboHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reciboTitle: { fontSize: 20, fontWeight: 'bold', color: '#8D0000' },
  reciboBody: { maxHeight: 400 },
  reciboSubtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 12 },
  divisor: { borderTopWidth: 1, borderTopColor: '#DDD', marginVertical: 8 },
  reciboInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reciboLabel: { fontSize: 13, color: '#888' },
  reciboValue: { fontSize: 13, color: '#333', fontWeight: '600' },
  reciboSecTitle: { fontSize: 12, fontWeight: '800', color: '#555', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  reciboItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  reciboItemQtd: { fontSize: 13, fontWeight: '700', color: '#8D0000', width: 30, textAlign: 'center' },
  reciboItemNome: { fontSize: 13, color: '#333', flex: 1 },
  reciboItemValor: { fontSize: 13, color: '#333', fontWeight: '600' },
  reciboTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reciboTotalLabel: { fontSize: 14, color: '#555' },
  reciboTotalValor: { fontSize: 14, color: '#333', fontWeight: '600' },
  reciboActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  reciboActionBtn: { flex: 1, backgroundColor: '#8D0000', borderRadius: 30, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reciboActionText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
});
