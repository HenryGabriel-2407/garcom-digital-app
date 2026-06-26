import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import api from '../../../../services/api';

interface CupomResponse {
  valido: boolean;
  desconto_percentual?: number;
  valor_desconto?: number;
  valor_final?: number;
  id?: number;
  codigo?: string;
}

interface ItemPedido {
  tipo: 'produto' | 'combo';
  itemId: number;
  nome: string;
  preco: number;
  quantidade: number;
  observacao?: string;
}

interface MetodoPagamento {
  id: number;
  nome: string;
  ativo: boolean;
}

interface ClienteResult {
  id: number;
  nome: string;
  email: string;
  documento?: string;
  telefone?: string;
}

export default function NovaComandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    tipo?: string;
    itemId?: string;
    nome?: string;
    preco?: string;
    quantidade?: string;
    observacao?: string;
  }>();

  const mesaId = params.id;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteResult | null>(null);
  const [resultadosClientes, setResultadosClientes] = useState<ClienteResult[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [showResultados, setShowResultados] = useState(false);

  const [nomeCliente, setNomeCliente] = useState('');
  const [qtdPessoas, setQtdPessoas] = useState(1);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [, setMetodos] = useState<MetodoPagamento[]>([]);
  const [metodoId, setMetodoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [codigoCupom, setCodigoCupom] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState<CupomResponse | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  // Recebe item vindo da tela de produto/combo
  useEffect(() => {
    if (params.itemId && params.nome && params.preco) {
      const novoItem: ItemPedido = {
        tipo: (params.tipo as 'produto' | 'combo') ?? 'produto',
        itemId: Number(params.itemId),
        nome: params.nome,
        preco: Number(params.preco),
        quantidade: Number(params.quantidade ?? 1),
        observacao: params.observacao || undefined,
      };
      setItens((prev) => {
        // Se já existe o mesmo item, soma a quantidade
        const idx = prev.findIndex(
          (i) => i.tipo === novoItem.tipo && i.itemId === novoItem.itemId
        );
        if (idx >= 0) {
          const atualizado = [...prev];
          atualizado[idx].quantidade += novoItem.quantidade;
          return atualizado;
        }
        return [...prev, novoItem];
      });
    }
  }, [params.itemId]);

  // Busca clientes com debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (clienteSelecionado) return;
    const q = clienteBusca.trim();
    if (q.length < 2) {
      setResultadosClientes([]);
      setShowResultados(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscandoClientes(true);
      try {
        const { data } = await api.get<ClienteResult[]>('/clientes/busca', { params: { q } });
        setResultadosClientes(data);
        setShowResultados(data.length > 0);
      } catch {
        setResultadosClientes([]);
      } finally {
        setBuscandoClientes(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [clienteBusca, clienteSelecionado]);

  const selecionarCliente = (c: ClienteResult) => {
    setClienteSelecionado(c);
    setClienteBusca('');
    setResultadosClientes([]);
    setShowResultados(false);
  };

  const limparClienteSelecionado = () => {
    setClienteSelecionado(null);
    setClienteBusca('');
    setNomeCliente('');
  };

  // Busca métodos de pagamento
  useEffect(() => {
    api.get<MetodoPagamento[]>('/metodos-pagamento/')
      .then(({ data }) => {
        const ativos = data.filter((m) => m.ativo);
        setMetodos(ativos);
        if (ativos.length > 0) setMetodoId(ativos[0].id);
      })
      .catch(() => {});
  }, []);

  const removerItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const totalComanda = itens.reduce(
    (acc, item) => acc + item.preco * item.quantidade,
    0
  );

  const valorComDesconto = cupomAplicado?.valor_final ?? totalComanda;
  const descontoValor = cupomAplicado?.valor_desconto ?? 0;

  const validarCupom = async () => {
    if (!codigoCupom.trim()) {
      Alert.alert('Atenção', 'Digite um código de cupom.');
      return;
    }
    setValidandoCupom(true);
    try {
      const { data } = await api.post<CupomResponse>('/promocoes/validar', {
        codigo: codigoCupom.trim(),
        valor_pedido: totalComanda,
      });
      if (data.valido) {
        setCupomAplicado(data);
        Alert.alert('Cupom aplicado!', `${data.desconto_percentual}% de desconto (R$ ${data.valor_desconto?.toFixed(2).replace('.', ',')})`);
      } else {
        Alert.alert('Cupom inválido', 'O código informado não é válido.');
        setCupomAplicado(null);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Erro ao validar cupom.');
      setCupomAplicado(null);
    } finally {
      setValidandoCupom(false);
    }
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
        let metodoIdAtual = metodoId;

        if (!metodoIdAtual) {
        const { data: metodosAtivos } = await api.get<MetodoPagamento[]>('/metodos-pagamento/');
        const ativos = metodosAtivos.filter(m => m.ativo);
        if (ativos.length > 0) {
            metodoIdAtual = ativos[0].id;
        } else {
            const { data: novoMetodo } = await api.post<MetodoPagamento>('/metodos-pagamento/', {
            nome: 'Dinheiro',
            ativo: true
            });
            metodoIdAtual = novoMetodo.id;
            setMetodos([novoMetodo]);
            setMetodoId(novoMetodo.id);
        }
        }

        // 1. Ocupa a mesa
        await api.post(`/mesas/${mesaId}/ocupar`);

        // 2. Monta itens com id_comanda = 0 (valor temporário, o backend vai associar corretamente)
        const pedidoItens = itens.map((item) => ({
        id_produto: item.tipo === 'produto' ? item.itemId : undefined,
        id_combo: item.tipo === 'combo' ? item.itemId : undefined,
        quantidade: item.quantidade,
        preco_unitario: item.preco,
        subtotal: item.preco * item.quantidade,
        observacao: item.observacao || null,
        id_comanda: 0,           // ← campo obrigatório
        }));

        // 3. Cria comanda com todos os campos esperados
        const observacao = clienteSelecionado
          ? null
          : (nomeCliente ? `Cliente: ${nomeCliente}` : null);

        await api.post('/comandas/', {
        id_mesa: Number(mesaId),
        id_garcom: user?.id,
        id_cliente: clienteSelecionado?.id || undefined,
        id_metodo_pagamento: metodoIdAtual,
        id_cod_promocional: cupomAplicado?.id || undefined,
        preco_total: totalComanda,
        desconto_aplicado: descontoValor,
        taxa_entrega: 0,
        valor_a_pagar: valorComDesconto,
        troco: 0,
        status_comanda: 'aberta',
        status_pagamento: 'pendente',
        tipo_entrega: 'local',
        origem: 'mobile_garcom',
        observacao_geral: observacao,
        pedido_itens: pedidoItens,
        });

        Alert.alert('Sucesso', 'Comanda aberta com sucesso!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/mesas') },
        ]);
    } catch (err: any) {
        // Exibe detalhes do erro 422 para depuração
        const detail = err.response?.data?.detail;
        const message = detail ? JSON.stringify(detail) : 'Erro ao criar comanda.';
        Alert.alert('Erro', message);
    } finally {
        setLoading(false);
    }
    };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color="#555" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Comanda</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.mesaLabel}>Mesa {mesaId}</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cliente - busca ou nome livre */}
        <Text style={styles.label}>Cliente <Text style={styles.opcional}>(opcional)</Text></Text>

        {clienteSelecionado ? (
          <View style={styles.clienteSelecionadoRow}>
            <View style={styles.clienteSelecionadoInfo}>
              <Feather name="user-check" size={16} color="#2A6B2A" />
              <Text style={styles.clienteSelecionadoNome}>{clienteSelecionado.nome}</Text>
              {clienteSelecionado.documento && (
                <Text style={styles.clienteSelecionadoDoc}>CPF: {clienteSelecionado.documento}</Text>
              )}
            </View>
            <TouchableOpacity onPress={limparClienteSelecionado}>
              <Feather name="x" size={18} color="#CC0000" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.clienteBuscaWrapper}>
            <TextInput
              style={styles.input}
              value={clienteBusca}
              onChangeText={(t) => { setClienteBusca(t); if (!t) setNomeCliente(''); }}
              placeholder="Nome, e-mail ou CPF do cliente..."
              placeholderTextColor="#BBB"
            />
            {buscandoClientes && (
              <ActivityIndicator size="small" color="#8D0000" style={styles.clienteBuscaSpinner} />
            )}
            {showResultados && resultadosClientes.length > 0 && (
              <View style={styles.clienteResultados}>
                {resultadosClientes.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.clienteResultadoItem}
                    onPress={() => selecionarCliente(c)}
                  >
                    <Feather name="user" size={16} color="#555" />
                    <View style={styles.clienteResultadoInfo}>
                      <Text style={styles.clienteResultadoNome}>{c.nome}</Text>
                      <Text style={styles.clienteResultadoEmail}>{c.email}</Text>
                      {c.documento && (
                        <Text style={styles.clienteResultadoDoc}>CPF: {c.documento}</Text>
                      )}
                    </View>
                    <Feather name="chevron-right" size={16} color="#CCC" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!buscandoClientes && clienteBusca.trim().length >= 2 && resultadosClientes.length === 0 && (
              <TouchableOpacity
                style={styles.novoClienteBtn}
                onPress={() => { setNomeCliente(clienteBusca.trim()); setShowResultados(false); }}
              >
                <Feather name="user-plus" size={14} color="#555" />
                <Text style={styles.novoClienteText}>Usar "{clienteBusca.trim()}" como nome do cliente</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quantidade de pessoas */}
        <Text style={styles.label}>Quantidade de pessoas</Text>
        <View style={styles.qtdRow}>
          <TouchableOpacity onPress={() => setQtdPessoas((q) => Math.max(1, q - 1))}>
            <Feather name="minus" size={20} color="#8D0000" />
          </TouchableOpacity>
          <Text style={styles.qtdValor}>{qtdPessoas}</Text>
          <TouchableOpacity onPress={() => setQtdPessoas((q) => q + 1)}>
            <Feather name="plus" size={20} color="#8D0000" />
          </TouchableOpacity>
        </View>

        {/* Itens do pedido */}
        <Text style={styles.sectionTitle}>ITENS DO PEDIDO</Text>

        {/* Busca / atalho para cardápio */}
        <TouchableOpacity
          style={styles.searchBox}
          onPress={() => router.push(`/(tabs)/mesas/${mesaId}/cardapio`)}
          activeOpacity={0.7}
        >
          <Feather name="search" size={16} color="#999" />
          <Text style={styles.searchPlaceholder}>Buscar produtos (Ex: Pizza de Calabresa)</Text>
        </TouchableOpacity>

        {/* Lista de itens adicionados */}
        <View style={styles.itensBox}>
            {itens.length === 0 ? (
                <View style={styles.emptyItens}>
                <Feather name="scissors" size={32} color="#CCC" />
                <Text style={styles.emptyText}>Nenhum item adicionado à mesa {mesaId}</Text>
                <TouchableOpacity
                    style={styles.addItemBtn}
                    onPress={() => router.push(`/(tabs)/mesas/${mesaId}/cardapio`)}
                >
                    <Feather name="plus-circle" size={16} color="#8D0000" />
                    <Text style={styles.addItemText}>Adicionar item</Text>
                </TouchableOpacity>
                </View>
            ) : (
                <>
                {itens.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemNome}>
                        {item.quantidade}x {item.nome}
                        </Text>
                        <Text style={styles.itemPreco}>
                        R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                        </Text>
                        {item.observacao && (
                        <Text style={styles.itemObs}>{item.observacao}</Text>
                        )}
                    </View>
                    <TouchableOpacity onPress={() => removerItem(idx)}>
                        <Feather name="trash-2" size={18} color="#CC0000" />
                    </TouchableOpacity>
                    </View>
                ))}
                {/* Botão extra quando já existem itens */}
                <TouchableOpacity
                    style={[styles.addItemBtn, { marginTop: 12 }]}
                    onPress={() => router.push(`/(tabs)/mesas/${mesaId}/cardapio`)}
                >
                    <Feather name="plus-circle" size={16} color="#8D0000" />
                    <Text style={styles.addItemText}>Adicionar mais itens</Text>
                </TouchableOpacity>
                </>
            )}
            </View>

        {/* Cupom promocional */}
        <View style={styles.cupomBox}>
          <Text style={styles.label}>Cupom promocional <Text style={styles.opcional}>(opcional)</Text></Text>
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
              <TouchableOpacity
                style={styles.cupomRemoveBtn}
                onPress={() => { setCupomAplicado(null); setCodigoCupom(''); }}
              >
                <Feather name="x" size={18} color="#CC0000" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cupomBtn}
                onPress={validarCupom}
                disabled={validandoCupom}
              >
                {validandoCupom ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.cupomBtnText}>Validar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {cupomAplicado && (
            <Text style={styles.cupomSucesso}>
              {cupomAplicado.desconto_percentual}% de desconto aplicado!
            </Text>
          )}
        </View>

        {/* Total */}
        {itens.length > 0 && (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValor}>
                R$ {totalComanda.toFixed(2).replace('.', ',')}
              </Text>
            </View>
            {descontoValor > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.descontoLabel}>Desconto</Text>
                <Text style={styles.descontoValor}>
                  - R$ {descontoValor.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.totalFinal]}>
              <Text style={styles.totalFinalLabel}>Total</Text>
              <Text style={styles.totalFinalValor}>
                R$ {valorComDesconto.toFixed(2).replace('.', ',')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Rodapé */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelarBtn}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelarText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.salvarBtn, loading && { opacity: 0.7 }]}
          onPress={handleSalvar}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.salvarText}>Salvar e abrir comanda</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#8D0000' },
  mesaLabel: { fontSize: 14, color: '#555', paddingHorizontal: 20, marginBottom: 20 },

  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  opcional: { fontWeight: '400', color: '#888' },

  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE',
  },

  qtdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#FFF',
    borderRadius: 10,
    height: 48,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  qtdValor: { fontSize: 18, fontWeight: 'bold', color: '#333', minWidth: 32, textAlign: 'center' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  searchPlaceholder: { fontSize: 13, color: '#BBB' },

  itensBox: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    minHeight: 120,
  },
  emptyItens: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  emptyText: { fontSize: 13, color: '#999', textAlign: 'center' },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#8D0000',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  addItemText: { color: '#8D0000', fontSize: 13, fontWeight: '600' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemNome: { fontSize: 14, fontWeight: '600', color: '#333' },
  itemPreco: { fontSize: 13, color: '#8D0000', fontWeight: '700', marginTop: 2 },
  itemObs: { fontSize: 12, color: '#999', marginTop: 2 },

  cupomBox: { marginBottom: 16, marginTop: 8 },
  cupomInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cupomInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  cupomBtn: {
    backgroundColor: '#8D0000',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cupomBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  cupomRemoveBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cupomSucesso: { color: '#2A6B2A', fontSize: 12, fontWeight: '600', marginTop: 6 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 14, color: '#555' },
  totalValor: { fontSize: 14, color: '#333', fontWeight: '600' },
  descontoLabel: { fontSize: 14, color: '#2A6B2A', fontWeight: '600' },
  descontoValor: { fontSize: 14, color: '#2A6B2A', fontWeight: 'bold' },
  totalFinal: { borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 4, paddingTop: 10 },
  totalFinalLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  totalFinalValor: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },

  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    backgroundColor: '#FDF5E6',
  },
  cancelarBtn: {
    flex: 1,
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  cancelarText: { fontSize: 15, fontWeight: '600', color: '#555' },
  salvarBtn: {
    flex: 2,
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8D0000',
  },
  salvarText: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },

  clienteBuscaWrapper: { position: 'relative', marginBottom: 20 },
  clienteBuscaSpinner: { position: 'absolute', right: 14, top: 12 },
  clienteResultados: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEE',
    maxHeight: 200,
    overflow: 'hidden',
    marginTop: -12,
    marginBottom: 8,
  },
  clienteResultadoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 10,
  },
  clienteResultadoInfo: { flex: 1 },
  clienteResultadoNome: { fontSize: 14, fontWeight: '600', color: '#333' },
  clienteResultadoEmail: { fontSize: 12, color: '#888' },
  clienteResultadoDoc: { fontSize: 11, color: '#AAA' },
  novoClienteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: -12,
    marginBottom: 8,
  },
  novoClienteText: { fontSize: 13, color: '#555', flex: 1 },
  clienteSelecionadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FFF0',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  clienteSelecionadoInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  clienteSelecionadoNome: { fontSize: 14, fontWeight: '600', color: '#2A6B2A' },
  clienteSelecionadoDoc: { fontSize: 11, color: '#888' },
});