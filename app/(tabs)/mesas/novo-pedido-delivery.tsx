import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';

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

interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
}

interface Endereco {
  id: number;
  apelido: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  cep?: string;
  padrao: boolean;
}

export default function NovoPedidoDeliveryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [, setMetodos] = useState<MetodoPagamento[]>([]);
  const [metodoId, setMetodoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [clienteModal, setClienteModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);

  const [enderecoModal, setEnderecoModal] = useState(false);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoSel, setEnderecoSel] = useState<Endereco | null>(null);

  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    api.get<MetodoPagamento[]>('/metodos-pagamento/')
      .then(({ data }) => {
        const ativos = data.filter((m) => m.ativo);
        setMetodos(ativos);
        if (ativos.length > 0) setMetodoId(ativos[0].id);
      })
      .catch(() => {});
  }, []);

  const buscarClientes = async (termo: string) => {
    if (!termo.trim()) return;
    try {
      const { data } = await api.get<Cliente[]>('/clientes/', {
        params: { busca: termo, limite: 20 },
      });
      setClientes(data);
    } catch {
      Alert.alert('Erro', 'Falha ao buscar clientes.');
    }
  };

  const carregarEnderecos = async (clienteId: number) => {
    try {
      const { data } = await api.get<{ enderecos: Endereco[] }>(`/clientes/${clienteId}`);
      setEnderecos(data.enderecos || []);
    } catch {
      setEnderecos([]);
    }
  };

  const selecionarCliente = async (c: Cliente) => {
    setClienteSel(c);
    setClienteModal(false);
    await carregarEnderecos(c.id);
    const padrao = enderecos.find((e) => e.padrao);
    if (padrao) setEnderecoSel(padrao);
  };

  const totalPedido = itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

  const handleSalvar = async () => {
    if (!clienteSel) {
      Alert.alert('Atenção', 'Selecione um cliente.');
      return;
    }
    if (!enderecoSel) {
      Alert.alert('Atenção', 'Selecione um endereço de entrega.');
      return;
    }
    if (itens.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um item ao pedido.');
      return;
    }

    setLoading(true);
    try {
      let metodoIdAtual = metodoId;
      if (!metodoIdAtual) {
        const { data: metodosAtivos } = await api.get<MetodoPagamento[]>('/metodos-pagamento/');
        const ativos = metodosAtivos.filter((m) => m.ativo);
        if (ativos.length > 0) {
          metodoIdAtual = ativos[0].id;
        } else {
          const { data: novoMetodo } = await api.post<MetodoPagamento>('/metodos-pagamento/', {
            nome: 'Dinheiro',
            ativo: true,
          });
          metodoIdAtual = novoMetodo.id;
        }
      }

      const pedidoItens = itens.map((item) => ({
        id_produto: item.tipo === 'produto' ? item.itemId : undefined,
        id_combo: item.tipo === 'combo' ? item.itemId : undefined,
        quantidade: item.quantidade,
        preco_unitario: item.preco,
        subtotal: item.preco * item.quantidade,
        observacao: item.observacao || null,
        id_comanda: 0,
      }));

      await api.post('/comandas/', {
        id_cliente: clienteSel.id,
        id_garcom: user?.id,
        id_metodo_pagamento: metodoIdAtual,
        preco_total: totalPedido,
        desconto_aplicado: 0,
        taxa_entrega: 5.0,
        valor_a_pagar: totalPedido + 5.0,
        troco: 0,
        status_comanda: 'aberta',
        status_pagamento: 'pendente',
        tipo_entrega: 'delivery',
        origem: 'mobile_garcom',
        observacao_geral: `Entrega: ${enderecoSel.rua}, ${enderecoSel.numero} - ${enderecoSel.bairro}${observacao ? ` | Obs: ${observacao}` : ''}`,
        pedido_itens: pedidoItens,
      });

      Alert.alert('Sucesso', 'Pedido delivery criado com sucesso!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/mesas') },
      ]);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      Alert.alert('Erro', detail ? JSON.stringify(detail) : 'Erro ao criar pedido.');
    } finally {
      setLoading(false);
    }
  };

  const removerItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color="#555" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Pedido Delivery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Seletor de Cliente */}
        <Text style={styles.label}>Cliente <Text style={styles.obrigatorio}>*</Text></Text>
        <TouchableOpacity style={styles.seletorBtn} onPress={() => setClienteModal(true)}>
          <Feather name="user" size={16} color="#999" />
          <Text style={[styles.seletorTexto, !clienteSel && { color: '#BBB' }]}>
            {clienteSel ? clienteSel.nome : 'Selecionar cliente...'}
          </Text>
          <Feather name="chevron-down" size={16} color="#999" />
        </TouchableOpacity>

        {clienteSel && (
          <>
            {/* Seletor de Endereço */}
            <Text style={styles.label}>Endereço de entrega <Text style={styles.obrigatorio}>*</Text></Text>
            <TouchableOpacity style={styles.seletorBtn} onPress={() => setEnderecoModal(true)}>
              <Feather name="map-pin" size={16} color="#999" />
              <Text style={[styles.seletorTexto, !enderecoSel && { color: '#BBB' }]} numberOfLines={1}>
                {enderecoSel
                  ? `${enderecoSel.rua}, ${enderecoSel.numero} - ${enderecoSel.bairro}`
                  : 'Selecionar endereço...'}
              </Text>
              <Feather name="chevron-down" size={16} color="#999" />
            </TouchableOpacity>
          </>
        )}

        {/* Observação */}
        <Text style={styles.label}>Observação <Text style={styles.opcional}>(opcional)</Text></Text>
        <TextInput
          style={styles.inputMultiline}
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Ex.: Telefone para contato, portão..."
          placeholderTextColor="#BBB"
          multiline
        />

        {/* Itens do pedido */}
        <Text style={styles.sectionTitle}>ITENS DO PEDIDO</Text>

        <TouchableOpacity
          style={styles.searchBox}
          onPress={() => router.push('/(tabs)/mesas/0/cardapio')}
          activeOpacity={0.7}
        >
          <Feather name="search" size={16} color="#999" />
          <Text style={styles.searchPlaceholder}>Buscar produtos para adicionar...</Text>
        </TouchableOpacity>

        <View style={styles.itensBox}>
          {itens.length === 0 ? (
            <View style={styles.emptyItens}>
              <Feather name="shopping-bag" size={32} color="#CCC" />
              <Text style={styles.emptyText}>Nenhum item adicionado</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => router.push('/(tabs)/mesas/0/cardapio')}
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
                    <Text style={styles.itemNome}>{item.quantidade}x {item.nome}</Text>
                    <Text style={styles.itemPreco}>R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</Text>
                    {item.observacao && <Text style={styles.itemObs}>{item.observacao}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removerItem(idx)}>
                    <Feather name="trash-2" size={18} color="#CC0000" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addItemBtn, { marginTop: 12 }]}
                onPress={() => router.push('/(tabs)/mesas/0/cardapio')}
              >
                <Feather name="plus-circle" size={16} color="#8D0000" />
                <Text style={styles.addItemText}>Adicionar mais itens</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Total */}
        {itens.length > 0 && (
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValor}>R$ {totalPedido.toFixed(2).replace('.', ',')}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Taxa de entrega</Text>
              <Text style={styles.totalValor}>R$ 5,00</Text>
            </View>
            <View style={[styles.totalRow, styles.totalFinal]}>
              <Text style={styles.totalFinalLabel}>Total</Text>
              <Text style={styles.totalFinalValor}>R$ {(totalPedido + 5).toFixed(2).replace('.', ',')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelarBtn} onPress={() => router.back()} disabled={loading}>
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
            <Text style={styles.salvarText}>Criar pedido delivery</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal de seleção de cliente */}
      <Modal visible={clienteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Cliente</Text>
              <TouchableOpacity onPress={() => setClienteModal(false)}>
                <Feather name="x" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBusca}>
              <TextInput
                style={styles.modalInputBusca}
                placeholder="Buscar por nome ou email..."
                placeholderTextColor="#BBB"
                value={buscaCliente}
                onChangeText={(t) => { setBuscaCliente(t); buscarClientes(t); }}
              />
            </View>

            <FlatList
              data={clientes}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.clienteItem} onPress={() => selecionarCliente(item)}>
                  <View style={styles.clienteAvatar}>
                    <Text style={styles.clienteAvatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.clienteInfo}>
                    <Text style={styles.clienteNome}>{item.nome}</Text>
                    <Text style={styles.clienteEmail}>{item.email}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#CCC" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  {buscaCliente ? 'Nenhum cliente encontrado.' : 'Digite para buscar...'}
                </Text>
              }
              style={{ maxHeight: 300 }}
            />

            <TouchableOpacity
              style={styles.novoClienteBtn}
              onPress={() => {
                setClienteModal(false);
                Alert.alert('Em breve', 'Cadastro de cliente será implementado em breve.');
              }}
            >
              <Feather name="user-plus" size={16} color="#8D0000" />
              <Text style={styles.novoClienteText}>Cadastrar novo cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de seleção de endereço */}
      <Modal visible={enderecoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Endereço de Entrega</Text>
              <TouchableOpacity onPress={() => setEnderecoModal(false)}>
                <Feather name="x" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={enderecos}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.enderecoItem, enderecoSel?.id === item.id && styles.enderecoItemAtivo]}
                  onPress={() => { setEnderecoSel(item); setEnderecoModal(false); }}
                >
                  <View style={styles.enderecoHeader}>
                    <Feather name="map-pin" size={16} color="#8D0000" />
                    <Text style={styles.enderecoApelido}>{item.apelido || 'Endereço'}</Text>
                    {item.padrao && <Text style={styles.padraoBadge}>PADRÃO</Text>}
                  </View>
                  <Text style={styles.enderecoCompleto}>
                    {item.rua}, {item.numero}{item.complemento ? ` - ${item.complemento}` : ''}
                  </Text>
                  <Text style={styles.enderecoBairro}>{item.bairro} - {item.cidade}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>Nenhum endereço cadastrado.</Text>
              }
              style={{ maxHeight: 350 }}
            />
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },

  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 4 },
  opcional: { fontWeight: '400', color: '#888' },
  obrigatorio: { color: '#CC0000' },

  seletorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  seletorTexto: { flex: 1, fontSize: 14, color: '#333' },

  inputMultiline: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE',
    textAlignVertical: 'top',
  },

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

  totalBox: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 14, color: '#555' },
  totalValor: { fontSize: 14, color: '#333', fontWeight: '600' },
  totalFinal: { borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 6, paddingTop: 10 },
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

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalBusca: { marginBottom: 12 },
  modalInputBusca: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: '#333',
  },

  clienteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  clienteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8D0000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clienteAvatarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  clienteInfo: { flex: 1 },
  clienteNome: { fontSize: 15, fontWeight: '600', color: '#333' },
  clienteEmail: { fontSize: 13, color: '#888' },

  novoClienteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  novoClienteText: { color: '#8D0000', fontSize: 14, fontWeight: '600' },

  enderecoItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  enderecoItemAtivo: { borderColor: '#8D0000', backgroundColor: '#FFF5F5' },
  enderecoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  enderecoApelido: { fontSize: 14, fontWeight: '700', color: '#333', flex: 1 },
  padraoBadge: { fontSize: 10, fontWeight: '700', color: '#2A6B2A', backgroundColor: '#E8FFE8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  enderecoCompleto: { fontSize: 14, color: '#555', marginLeft: 24 },
  enderecoBairro: { fontSize: 13, color: '#888', marginLeft: 24 },

  emptyListText: { textAlign: 'center', color: '#999', paddingVertical: 20 },
});
