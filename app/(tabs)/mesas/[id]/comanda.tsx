import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Modal, TextInput,
  RefreshControl, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../../../services/api';

interface ProdutoDetalhe { nome: string; imagem_link: string }
interface ComboDetalhe { nome: string; imagem_link: string }
type ItemDetalhe = ProdutoDetalhe | ComboDetalhe;

interface PedidoItemResponse {
  id: number; id_comanda: number;
  id_produto: number | null; id_combo: number | null;
  quantidade: number; preco_unitario: number;
  subtotal: number; observacao: string | null;
}

interface ComandaResponse {
  id: number; id_mesa: number | null; id_garcom: number | null;
  id_metodo_pagamento?: number;
  valor_a_pagar: number; preco_total: number;
  desconto_aplicado: number; taxa_entrega: number; troco: number;
  status_comanda: string; tipo_entrega: string;
  data_registro: string; data_finalizacao?: string | null;
  observacao_geral: string | null;
  mesa_rel?: { numero: number };
  garcom_rel?: { nome: string };
  cliente_rel?: { nome: string; email?: string };
  metodo_pagamento_rel: { nome: string };
  cod_promocional_rel?: { codigo: string; desconto_percentual: number };
  pedido_itens: PedidoItemResponse[];
}

interface MetodoPagamento { id: number; nome: string; ativo: boolean }
interface CupomResponse {
  valido: boolean; desconto_percentual?: number;
  valor_desconto?: number; valor_final?: number;
  id?: number; codigo?: string;
}

type DetalheMap = Record<number, ItemDetalhe>;

const nomeClienteComanda = (c: ComandaResponse) =>
  c.cliente_rel?.nome || (c.observacao_geral?.startsWith('Cliente: ') ? c.observacao_geral.slice(9) : null);

export default function ComandaScreen() {
  const router = useRouter();
  const { id: mesaId } = useLocalSearchParams<{ id: string }>();

  const [comanda, setComanda] = useState<ComandaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState('');
  const [detalhes, setDetalhes] = useState<DetalheMap>({});

  // Timeline
  interface StatusLog {
    id: number; status_anterior: string | null; status_novo: string;
    alterado_por_tipo: string; timestamp: string; observacao: string | null;
  }
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PedidoItemResponse | null>(null);
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [novaObservacao, setNovaObservacao] = useState('');

  // Cupom
  const [codigoCupom, setCodigoCupom] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState<CupomResponse | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  // Finalization
  const [finalizarVisible, setFinalizarVisible] = useState(false);
  const [metodosPagamento, setMetodosPagamento] = useState<MetodoPagamento[]>([]);
  const [selectedMetodoId, setSelectedMetodoId] = useState<number | null>(null);
  const [valorPago, setValorPago] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [showMetodoPicker, setShowMetodoPicker] = useState(false);

  // Receipt
  const [reciboVisible, setReciboVisible] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const buscarDetalhesDosItens = useCallback(async (itens: PedidoItemResponse[]) => {
    const idsProdutos = itens.filter(i => i.id_produto).map(i => i.id_produto!);
    const idsCombos = itens.filter(i => i.id_combo).map(i => i.id_combo!);
    const novosDetalhes: DetalheMap = {};
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
        if (comandaAtiva.cod_promocional_rel) {
          setCupomAplicado({
            valido: true,
            codigo: comandaAtiva.cod_promocional_rel.codigo,
            desconto_percentual: comandaAtiva.cod_promocional_rel.desconto_percentual,
            valor_desconto: comandaAtiva.desconto_aplicado,
            id: comandaAtiva.cod_promocional_rel.desconto_percentual,
          });
          setCodigoCupom(comandaAtiva.cod_promocional_rel.codigo);
        }
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

  const abrirTimeline = async () => {
    if (!comanda) return;
    setLoadingTimeline(true);
    setTimelineVisible(true);
    try {
      const { data } = await api.get<StatusLog[]>(`/comandas/${comanda.id}/status-logs`);
      setStatusLogs(data);
    } catch { setStatusLogs([]); }
    finally { setLoadingTimeline(false); }
  };

  const removerItem = (itemId: number) => {
    Alert.alert('Remover item', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try { await api.delete(`/comandas/itens/${itemId}`); await refreshComanda(); }
          catch (err: any) { Alert.alert('Erro', err.response?.data?.detail || 'Falha ao remover.'); }
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
      Alert.alert('Erro', 'Quantidade inválida.'); return;
    }
    try {
      await api.put(`/comandas/itens/${editingItem.id}`, {
        quantidade, observacao: novaObservacao || null,
      });
      setModalVisible(false);
      await refreshComanda();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Não foi possível atualizar.');
    }
  };

  const adicionarMaisItens = () => {
    if (!comanda) return;
    router.push({ pathname: `/(tabs)/mesas/${mesaId}/cardapio`, params: { comandaId: comanda.id.toString() } });
  };

  // ---- Cupom ----
  const validarCupom = async () => {
    if (!comanda || !codigoCupom.trim()) return;
    setValidandoCupom(true);
    try {
      const { data } = await api.post<CupomResponse>('/promocoes/validar', {
        codigo: codigoCupom.trim(), valor_pedido: comanda.preco_total,
      });
      if (data.valido) {
        await api.put(`/comandas/${comanda.id}`, {
          id_cod_promocional: data.id,
          desconto_aplicado: data.valor_desconto,
          valor_a_pagar: data.valor_final,
        });
        setCupomAplicado(data);
        await refreshComanda();
        Alert.alert('Cupom aplicado!', `${data.desconto_percentual}% de desconto`);
      } else {
        Alert.alert('Cupom inválido', 'O código informado não é válido.');
        setCupomAplicado(null);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Erro ao validar cupom.');
      setCupomAplicado(null);
    } finally { setValidandoCupom(false); }
  };

  const removerCupom = async () => {
    if (!comanda || !cupomAplicado) return;
    try {
      await api.put(`/comandas/${comanda.id}`, {
        id_cod_promocional: null,
        desconto_aplicado: 0,
        valor_a_pagar: comanda.preco_total + comanda.taxa_entrega,
      });
      setCupomAplicado(null);
      setCodigoCupom('');
      await refreshComanda();
    } catch { Alert.alert('Erro', 'Falha ao remover cupom.'); }
  };

  // ---- Recibo ----
  const gerarHtmlRecibo = (c: ComandaResponse): string => {
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
        .total-row { font-weight: bold; }
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
        <p><b>Pagamento:</b> ${c.metodo_pagamento_rel.nome}</p>
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
    if (!comanda) return;
    setGerandoPdf(true);
    try {
      const html = gerarHtmlRecibo(comanda);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Recibo #${comanda.id}` });
      } else {
        Alert.alert('PDF salvo', `Arquivo: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally { setGerandoPdf(false); }
  };

  const enviarEmail = async () => {
    if (!comanda) return;
    try {
      await api.post(`/comandas/${comanda.id}/enviar-recibo`);
      Alert.alert('Sucesso', 'Recibo enviado por e-mail.');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao enviar e-mail.';
      Alert.alert('Erro', msg);
    }
  };

  const abrirRecibo = () => {
    if (!comanda) return;
    // Se comanda não estiver paga, finalizar primeiro
    if (comanda.status_comanda !== 'paga') {
      Alert.alert('Finalize primeiro', 'A comanda precisa estar paga para gerar o recibo.');
      return;
    }
    setReciboVisible(true);
  };

  // ---- Finalização ----
  const finalizarComanda = async () => {
    if (!comanda) return;
    try {
      const { data } = await api.get<MetodoPagamento[]>('/metodos-pagamento/');
      const ativos = data.filter(m => m.ativo);
      setMetodosPagamento(ativos);
      setSelectedMetodoId(comanda.id_metodo_pagamento ?? ativos[0]?.id ?? null);
    } catch { /* usa o atual */ }
    setValorPago('');
    setFinalizarVisible(true);
  };

  const confirmarFinalizacao = async () => {
    if (!comanda) return;
    if (!selectedMetodoId) {
      Alert.alert('Atenção', 'Selecione o método de pagamento.'); return;
    }
    const pago = parseFloat(valorPago.replace(',', '.'));
    if (isNaN(pago) || pago <= 0) {
      Alert.alert('Atenção', 'Informe o valor pago.'); return;
    }
    setFinalizando(true);
    try {
      const trocoCalculado = Math.max(0, pago - comanda.valor_a_pagar);
      await api.put(`/comandas/${comanda.id}`, {
        id_metodo_pagamento: selectedMetodoId,
        troco: trocoCalculado,
      });

      let statusAtual = comanda.status_comanda;
      if (statusAtual === 'pronta') {
        await api.post(`/comandas/${comanda.id}/status`, {
          status_novo: 'entregue', observacao: 'Pedido entregue (automático)',
        });
        await refreshComanda();
        const { data: updated } = await api.get<ComandaResponse>(`/comandas/${comanda.id}`);
        setComanda(updated);
        statusAtual = updated.status_comanda;
      }

      if (statusAtual === 'entregue') {
        await api.post(`/comandas/${comanda.id}/status`, {
          status_novo: 'paga', observacao: 'Finalizada pelo garçom',
        });
        await refreshComanda();
        const { data: updated } = await api.get<ComandaResponse>(`/comandas/${comanda.id}`);
        setComanda(updated);
        setFinalizarVisible(false);

        Alert.alert('Comanda finalizada!', 'Deseja gerar o recibo?', [
          { text: 'Não', onPress: () => router.replace('/(tabs)/mesas') },
          { text: 'Sim', onPress: () => { setReciboVisible(true); } },
        ]);
      } else {
        Alert.alert('Aviso', 'A comanda não está pronta para ser finalizada.');
        setFinalizarVisible(false);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao finalizar.');
    } finally { setFinalizando(false); }
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

      <FlatList
        data={comanda.pedido_itens}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.infoBox}>
              {comanda.tipo_entrega === 'delivery' ? (
                <Text style={styles.infoText}>Delivery — {nomeClienteComanda(comanda) || 'N/D'}</Text>
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

            {/* Cupom */}
            {comanda.status_comanda !== 'paga' && comanda.status_comanda !== 'cancelada' && (
              <View style={styles.cupomBox}>
                <Text style={styles.cupomTitle}>CUPOM PROMOCIONAL</Text>
                <View style={styles.cupomInputRow}>
                  <TextInput
                    style={[styles.cupomInput, cupomAplicado && { borderColor: '#2A6B2A', backgroundColor: '#F0FFF0' }]}
                    value={codigoCupom}
                    onChangeText={(t) => { setCodigoCupom(t); if (cupomAplicado) setCupomAplicado(null); }}
                    placeholder="Digite o código..."
                    placeholderTextColor="#BBB"
                    editable={!cupomAplicado}
                    autoCapitalize="characters"
                  />
                  {cupomAplicado ? (
                    <TouchableOpacity style={styles.cupomRemoveBtn} onPress={removerCupom}>
                      <Feather name="x" size={18} color="#CC0000" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.cupomBtn} onPress={validarCupom} disabled={validandoCupom}>
                      {validandoCupom ? <ActivityIndicator size="small" color="#FFF" /> :
                        <Text style={styles.cupomBtnText}>Validar</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                {cupomAplicado && (
                  <Text style={styles.cupomSucesso}>{cupomAplicado.desconto_percentual}% de desconto aplicado!</Text>
                )}
              </View>
            )}

            <Text style={styles.sectionTitle}>ITENS DO PEDIDO</Text>
          </>
        }
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
        {comanda.status_comanda === 'paga' ? (
          <TouchableOpacity style={styles.reciboButton} onPress={abrirRecibo}>
            <Feather name="file-text" size={20} color="#FFF" />
            <Text style={styles.reciboText}>VER RECIBO</Text>
          </TouchableOpacity>
        ) : comanda.status_comanda !== 'cancelada' ? (
          <TouchableOpacity style={styles.finalizarButton} onPress={finalizarComanda}>
            <Text style={styles.finalizarText}>FINALIZAR COMANDA</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Timeline modal */}
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
                      aberta: 'Aberta', em_preparo: 'Em Preparo', pronta: 'Pronta',
                      entregue: 'Entregue', paga: 'Paga', cancelada: 'Cancelada',
                    };
                    return s ? (map[s] || s) : '—';
                  };
                  const getStatusColor = (s: string | null) => {
                    const map: Record<string, string> = {
                      aberta: '#8D0000', em_preparo: '#E68A00', pronta: '#2A6B2A',
                      entregue: '#2A3406', paga: '#555', cancelada: '#999',
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
                        <Text style={styles.timelineTime}>{new Date(log.timestamp).toLocaleString()}</Text>
                        {log.observacao && <Text style={styles.timelineObs}>{log.observacao}</Text>}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit item modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar item</Text>
            <Text style={styles.modalLabel}>Quantidade</Text>
            <TextInput style={styles.modalInput} keyboardType="numeric" value={novaQuantidade} onChangeText={setNovaQuantidade} />
            <Text style={styles.modalLabel}>Observação (opcional)</Text>
            <TextInput style={[styles.modalInput, { minHeight: 60 }]} multiline value={novaObservacao} onChangeText={setNovaObservacao} placeholder="Ex.: Sem cebola, bem passado..." />
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

      {/* Finalization modal */}
      <Modal visible={finalizarVisible} animationType="slide" transparent onRequestClose={() => setFinalizarVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>FINALIZAR COMANDA</Text>

            <View style={styles.finalizarInfoRow}>
              <Text style={styles.finalizarInfoLabel}>Valor a pagar</Text>
              <Text style={styles.finalizarInfoValue}>R$ {comanda?.valor_a_pagar.toFixed(2)}</Text>
            </View>

            <Text style={styles.modalLabel}>Forma de pagamento</Text>
            <TouchableOpacity style={styles.finalizarPickerBtn} onPress={() => setShowMetodoPicker(true)}>
              <Text style={[styles.finalizarPickerText, !selectedMetodoId && { color: '#BBB' }]}>
                {selectedMetodoId
                  ? metodosPagamento.find(m => m.id === selectedMetodoId)?.nome || 'Selecionar'
                  : 'Selecionar'}
              </Text>
              <Feather name="chevron-down" size={18} color="#555" />
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Valor pago pelo cliente</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor="#BBB"
              value={valorPago}
              onChangeText={setValorPago}
            />

            {valorPago.replace(',', '.') && !isNaN(parseFloat(valorPago.replace(',', '.'))) && (
              <View style={styles.finalizarInfoRow}>
                <Text style={styles.finalizarInfoLabel}>Troco</Text>
                <Text style={[styles.finalizarInfoValue, { color: '#2A6B2A' }]}>
                  R$ {Math.max(0, parseFloat(valorPago.replace(',', '.')) - (comanda?.valor_a_pagar || 0)).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setFinalizarVisible(false)} style={styles.modalBtnCancel} disabled={finalizando}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarFinalizacao} style={[styles.modalBtnSave, finalizando && { opacity: 0.7 }]} disabled={finalizando}>
                {finalizando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.modalBtnText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMetodoPicker} transparent animationType="fade" onRequestClose={() => setShowMetodoPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMetodoPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Forma de pagamento</Text>
            {metodosPagamento.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.pickerOption, selectedMetodoId === m.id && styles.pickerOptionActive]}
                onPress={() => { setSelectedMetodoId(m.id); setShowMetodoPicker(false); }}
              >
                <Text style={[styles.pickerOptionText, selectedMetodoId === m.id && styles.pickerOptionTextActive]}>{m.nome}</Text>
                {selectedMetodoId === m.id && <Feather name="check" size={18} color="#8D0000" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Receipt modal */}
      <Modal visible={reciboVisible} animationType="slide" transparent>
        <View style={styles.reciboOverlay}>
          <View style={styles.reciboContent}>
            <View style={styles.reciboHeader}>
              <Text style={styles.reciboTitle}>RECIBO</Text>
              <TouchableOpacity onPress={() => setReciboVisible(false)}>
                <Feather name="x" size={22} color="#555" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.reciboBody}>
              <Text style={styles.reciboSubtitle}>Comanda #{comanda.id}</Text>
              <View style={styles.divisor} />
              <View style={styles.reciboInfoRow}>
                <Text style={styles.reciboLabel}>Mesa:</Text>
                <Text style={styles.reciboValue}>{comanda.mesa_rel?.numero ?? 'XXXX'}</Text>
              </View>
              <View style={styles.reciboInfoRow}>
                <Text style={styles.reciboLabel}>Garçom:</Text>
                <Text style={styles.reciboValue}>{comanda.garcom_rel?.nome ?? 'XXXX'}</Text>
              </View>
              <View style={styles.reciboInfoRow}>
                <Text style={styles.reciboLabel}>Cliente:</Text>
                <Text style={styles.reciboValue}>{nomeClienteComanda(comanda) || 'XXXX'}</Text>
              </View>
              <View style={styles.reciboInfoRow}>
                <Text style={styles.reciboLabel}>Pagamento:</Text>
                <Text style={styles.reciboValue}>{comanda.metodo_pagamento_rel.nome}</Text>
              </View>
              <View style={styles.reciboInfoRow}>
                <Text style={styles.reciboLabel}>Data:</Text>
                <Text style={styles.reciboValue}>{new Date(comanda.data_registro).toLocaleString()}</Text>
              </View>

              <View style={styles.divisor} />
              <Text style={styles.reciboSecTitle}>ITENS</Text>
              {comanda.pedido_itens.map(item => {
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
                <Text style={styles.reciboTotalValor}>R$ {comanda.preco_total.toFixed(2)}</Text>
              </View>
              {comanda.desconto_aplicado > 0 && (
                <View style={styles.reciboTotalRow}>
                  <Text style={[styles.reciboTotalLabel, { color: '#2A6B2A' }]}>Desconto</Text>
                  <Text style={[styles.reciboTotalValor, { color: '#2A6B2A' }]}>- R$ {comanda.desconto_aplicado.toFixed(2)}</Text>
                </View>
              )}
              {comanda.taxa_entrega > 0 && (
                <View style={styles.reciboTotalRow}>
                  <Text style={styles.reciboTotalLabel}>Taxa entrega</Text>
                  <Text style={styles.reciboTotalValor}>R$ {comanda.taxa_entrega.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.reciboTotalRow, { borderTopWidth: 2, borderTopColor: '#333', paddingTop: 8, marginTop: 8 }]}>
                <Text style={[styles.reciboTotalLabel, { fontSize: 16 }]}>VALOR A PAGAR</Text>
                <Text style={[styles.reciboTotalValor, { fontSize: 16, color: '#8D0000' }]}>R$ {comanda.valor_a_pagar.toFixed(2)}</Text>
              </View>
              <View style={styles.reciboInfoRow}>
                <Text style={styles.reciboLabel}>Troco:</Text>
                <Text style={styles.reciboValue}>R$ {comanda.troco > 0 ? comanda.troco.toFixed(2) : 'XXXX'}</Text>
              </View>
            </ScrollView>

            <View style={styles.reciboActions}>
              <TouchableOpacity style={styles.reciboActionBtn} onPress={baixarPdf} disabled={gerandoPdf}>
                {gerandoPdf ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="download" size={18} color="#FFF" />
                    <Text style={styles.reciboActionText}>Baixar PDF</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.reciboActionBtn, { backgroundColor: '#2A6B2A' }]} onPress={enviarEmail}>
                <Feather name="mail" size={18} color="#FFF" />
                <Text style={styles.reciboActionText}>Enviar E-mail</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  infoBox: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  infoText: { fontSize: 14, color: '#333', marginBottom: 4 },
  obsGeral: { fontSize: 13, color: '#666', marginTop: 8, fontStyle: 'italic' },
  infoCupom: { fontSize: 13, color: '#2A6B2A', marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#555', letterSpacing: 1, marginBottom: 8, marginTop: 16, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 280 },

  // Cupom styles
  cupomBox: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  cupomTitle: { fontSize: 12, fontWeight: '800', color: '#555', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  cupomInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cupomInput: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, height: 44, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#EEE' },
  cupomBtn: { backgroundColor: '#8D0000', borderRadius: 10, paddingHorizontal: 16, height: 44, justifyContent: 'center', alignItems: 'center' },
  cupomBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  cupomRemoveBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFEEEE', justifyContent: 'center', alignItems: 'center' },
  cupomSucesso: { color: '#2A6B2A', fontSize: 12, fontWeight: '600', marginTop: 6 },

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
  footer: { borderTopWidth: 1, borderTopColor: '#EEE', paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20, backgroundColor: '#FDF5E6' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: 14, color: '#555' },
  totalValor: { fontSize: 14, color: '#333', fontWeight: '600' },
  descontoLabel: { fontSize: 14, color: '#2A6B2A', fontWeight: '600' },
  descontoValor: { fontSize: 14, color: '#2A6B2A', fontWeight: 'bold' },
  totalFinalRow: { borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10, marginTop: 6, marginBottom: 16 },
  totalFinalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  totalFinalValor: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  addButton: { backgroundColor: '#8D0000', borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, marginBottom: 12, marginHorizontal: 4 },
  addButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  finalizarButton: { backgroundColor: '#2A6B2A', borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginHorizontal: 4 },
  finalizarText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  reciboButton: { backgroundColor: '#555', borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, marginHorizontal: 4 },
  reciboText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  timelineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  timelineBtnText: { color: '#8D0000', fontSize: 13, fontWeight: '600', flex: 1 },

  // Timeline
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

  // Modal
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtnCancel: { backgroundColor: '#CCC', padding: 10, borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' },
  modalBtnSave: { backgroundColor: '#8D0000', padding: 10, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },

  // Finalization
  finalizarInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  finalizarInfoLabel: { fontSize: 15, color: '#555' },
  finalizarInfoValue: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  finalizarPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, marginBottom: 20,
  },
  finalizarPickerText: { fontSize: 16, color: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerModal: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, width: '80%', maxWidth: 320 },
  pickerModalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  pickerOptionActive: { backgroundColor: '#8D0000' + '08' },
  pickerOptionText: { fontSize: 15, color: '#333' },
  pickerOptionTextActive: { color: '#8D0000', fontWeight: '600' },

  // Recibo
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
