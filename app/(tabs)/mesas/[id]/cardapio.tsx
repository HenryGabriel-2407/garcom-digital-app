import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ActivityIndicator, SafeAreaView, Modal, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../services/api';

// ---------- Tipos ----------
interface Categoria {
  id: number;
  nome: string;
}

interface Produto {
  id: number;
  nome: string;
  descricao: string;
  imagem_link: string;
  preco: number;
  popular: boolean;
  disponivel: boolean;
  tempo_preparo_medio?: number;
  id_categoria: number;
  categoria_rel?: Categoria;
}

interface Combo {
  id: number;
  nome: string;
  imagem_link: string;
  preco: number;
  popular: boolean;
  disponivel: boolean;
  tempo_preparo_medio?: number;
}

type ItemCardapio = (Produto & { tipo: 'produto' }) | (Combo & { tipo: 'combo' });

// ─── Componente do card do item (com botão de adicionar) ─────────────────────
function ItemCard({ item, onPress }: { item: ItemCardapio; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: item.imagem_link }} style={styles.cardImage} resizeMode="cover" />
      <View style={styles.cardInfo}>
        {item.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>⭐ Popular</Text>
          </View>
        )}
        <Text style={styles.cardNome} numberOfLines={2}>{item.nome}</Text>
        {item.tempo_preparo_medio != null && (
          <View style={styles.tempoRow}>
            <Feather name="clock" size={12} color="#888" />
            <Text style={styles.tempoText}>{item.tempo_preparo_medio} minutos</Text>
          </View>
        )}
        <Text style={styles.cardPreco}>R$ {item.preco.toFixed(2).replace('.', ',')}</Text>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={onPress} activeOpacity={0.8}>
        <Feather name="plus" size={20} color="#FFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function CardapioScreen() {
  const router = useRouter();
  const { id: mesaId, comandaId } = useLocalSearchParams<{ id: string; comandaId?: string }>();
  const [numeroMesa, setNumeroMesa] = useState<number | null>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | 'todos' | 'combos'>('todos');

  // Modal para adicionar item diretamente (quando comandaId existe)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemCardapio | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [observacao, setObservacao] = useState('');

  const fetchTudo = useCallback(async () => {
    setLoading(true);
    try {
      const [resProdutos, resCombos, resCategorias] = await Promise.all([
        api.get<Produto[]>('/produtos/'),
        api.get<Combo[]>('/combos/'),
        api.get<Categoria[]>('/categorias/'),
      ]);
      setProdutos(resProdutos.data.filter((p) => p.disponivel));
      setCombos(resCombos.data.filter((c) => c.disponivel));
      setCategorias(resCategorias.data);
    } catch (error) {
      console.error('Erro ao carregar cardápio:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  const fetchMesa = useCallback(async () => {
    try {
        const { data } = await api.get<{ numero: number }>(`/mesas/${mesaId}`);
        setNumeroMesa(data.numero);
    } catch (error) {
        console.error('Erro ao buscar mesa:', error);
        setNumeroMesa(null);
    }
    }, [mesaId]);

  useEffect(() => { 
    fetchTudo(); 
    fetchMesa();
    }, [fetchTudo, fetchMesa]);

  // Filtragem
  const itensFiltrados: ItemCardapio[] = (() => {
    const termo = busca.toLowerCase().trim();
    let lista: ItemCardapio[] = [];
    if (categoriaAtiva === 'todos') {
      lista = [
        ...produtos.map((p) => ({ ...p, tipo: 'produto' as const })),
        ...combos.map((c) => ({ ...c, tipo: 'combo' as const })),
      ];
    } else if (categoriaAtiva === 'combos') {
      lista = combos.map((c) => ({ ...c, tipo: 'combo' as const }));
    } else {
      lista = produtos
        .filter((p) => p.id_categoria === categoriaAtiva)
        .map((p) => ({ ...p, tipo: 'produto' as const }));
    }
    if (termo) lista = lista.filter((i) => i.nome.toLowerCase().includes(termo));
    return lista;
  })();

  // Handlers de navegação / adição
  const handleItemPress = (item: ItemCardapio) => {
    const basePath = `/(tabs)/mesas/${mesaId}`;
    if (comandaId) {
        // Navega para a tela de detalhe, passando comandaId como parâmetro extra
        if (item.tipo === 'produto') {
        router.push({
            pathname: `${basePath}/produto/${item.id}`,
            params: { comandaId }
        });
        } else {
        router.push({
            pathname: `${basePath}/combo/${item.id}`,
            params: { comandaId }
        });
        }
    } else {
        // Fluxo original sem comanda ativa
        if (item.tipo === 'produto') {
        router.push(`${basePath}/produto/${item.id}`);
        } else {
        router.push(`${basePath}/combo/${item.id}`);
        }
    }
    };

  const adicionarItemComanda = async () => {
    if (!selectedItem || !comandaId) return;
    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd < 1) {
      Alert.alert('Erro', 'Quantidade inválida.');
      return;
    }

    const payload = {
      id_produto: selectedItem.tipo === 'produto' ? selectedItem.id : undefined,
      id_combo: selectedItem.tipo === 'combo' ? selectedItem.id : undefined,
      quantidade: qtd,
      observacao: observacao.trim() || null,
    };

    try {
      await api.post(`/comandas/${comandaId}/itens`, payload);
      Alert.alert('Sucesso', 'Item adicionado à comanda!');
      setModalVisible(false);
      // Opcional: voltar para a comanda após adicionar? Talvez sim.
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao adicionar item.');
    }
  };

  const tabsCategorias = [
    { id: 'todos' as const, nome: 'TODOS' },
    ...categorias.map((c) => ({ id: c.id as number | 'combos', nome: c.nome.toUpperCase() })),
    { id: 'combos' as const, nome: 'COMBOS' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#8D0000" />
          <Text style={styles.backText}>Mesa {numeroMesa}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CARDÁPIO</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={16} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar pizzas, bebidas, combos ..."
          placeholderTextColor="#999"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Feather name="x" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.categoriasRow}>
        <FlatList
          horizontal
          data={tabsCategorias}
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catTab, categoriaAtiva === item.id && styles.catTabActive]}
              onPress={() => setCategoriaAtiva(item.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catTabText, categoriaAtiva === item.id && styles.catTabTextActive]}>
                {item.nome}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8D0000" />
        </View>
      ) : (
        <FlatList
          data={itensFiltrados}
          keyExtractor={(item) => `${item.tipo}-${item.id}`}
          renderItem={({ item }) => <ItemCard item={item} onPress={() => handleItemPress(item)} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhum item encontrado.</Text>
            </View>
          }
        />
      )}

      {/* Modal para adicionar item com quantidade e observação (quando comandaId existe) */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar item</Text>
            <Text style={styles.modalLabel}>Quantidade</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={quantidade}
              onChangeText={setQuantidade}
            />
            <Text style={styles.modalLabel}>Observação (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              multiline
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex.: Sem cebola, bem passado..."
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={adicionarItemComanda} style={styles.modalBtnSave}>
                <Text style={styles.modalBtnText}>Adicionar</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backText: { color: '#8D0000', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  categoriasRow: { marginBottom: 8 },
  catTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EDE0CC',
  },
  catTabActive: { backgroundColor: '#8D0000' },
  catTabText: { fontSize: 12, fontWeight: '700', color: '#555' },
  catTabTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardImage: { width: 80, height: 80 },
  cardInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  popularText: { fontSize: 10, color: '#8D6000', fontWeight: '600' },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 4 },
  tempoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  tempoText: { fontSize: 12, color: '#888' },
  cardPreco: { fontSize: 15, fontWeight: 'bold', color: '#8D0000' },
  addBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#8D0000',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#999' },
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