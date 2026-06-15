import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../../services/api';

interface Produto {
  id: number;
  nome: string;
  descricao: string;
  imagem_link: string;
  preco: number;
  tempo_preparo_medio?: number;
  combos?: { id: number; nome: string }[];
}

export default function ProdutoDetalheScreen() {
  const router = useRouter();
  const { id: mesaId, produtoId, comandaId } = useLocalSearchParams<{ 
    id: string; 
    produtoId: string;
    comandaId?: string;
  }>();

  const [produto, setProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    api.get<Produto>(`/produtos/${produtoId}`)
      .then(({ data }) => setProduto(data))
      .finally(() => setLoading(false));
  }, [produtoId]);

  const handleAdicionar = async () => {
    if (!produto) return;

    // Se temos comandaId, adiciona diretamente à comanda existente
    if (comandaId) {
      try {
        await api.post(`/comandas/${comandaId}/itens`, {
          id_produto: produto.id,
          id_combo: undefined,
          quantidade,
          observacao: observacao.trim() || null,
        });
        Alert.alert('Sucesso', 'Item adicionado à comanda!');
        router.replace(`/(tabs)/mesas/${mesaId}/comanda`);
      } catch (err: any) {
        Alert.alert('Erro', err.response?.data?.detail || 'Falha ao adicionar item.');
      }
    } else {
      // Comportamento original: navega para nova-comanda
      router.push({
        pathname: `/(tabs)/mesas/${mesaId}/nova-comanda`,
        params: {
          tipo: 'produto',
          itemId: String(produto.id),
          nome: produto.nome,
          preco: String(produto.preco),
          quantidade: String(quantidade),
          observacao,
        },
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8D0000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!produto) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.erroText}>Produto não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const precoTotal = produto.preco * quantidade;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#8D0000" />
          <Text style={styles.backText}>Mesa {mesaId}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CARDÁPIO</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: produto.imagem_link }} style={styles.imagem} resizeMode="cover" />
        <View style={styles.content}>
          <Text style={styles.nome}>{produto.nome}</Text>
          {produto.tempo_preparo_medio != null && (
            <View style={styles.tempoRow}>
              <Feather name="clock" size={14} color="#888" />
              <Text style={styles.tempoText}>{produto.tempo_preparo_medio} min</Text>
            </View>
          )}
          <Text style={styles.descricao}>{produto.descricao}</Text>

          {produto.combos && produto.combos.length > 0 && (
            <View style={styles.combosBox}>
              <View style={styles.combosHeader}>
                <Feather name="box" size={16} color="#8D0000" />
                <Text style={styles.combosTitle}>ESTE PRODUTO ESTÁ INCLUÍDO NOS COMBOS:</Text>
              </View>
              {produto.combos.map((c) => (
                <Text key={c.id} style={styles.comboNome}>{c.nome}</Text>
              ))}
              <TouchableOpacity>
                <Text style={styles.verCombos}>Abrir mais combos</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.quantidadeRow}>
            <Text style={styles.quantidadeLabel}>Quantidade</Text>
            <View style={styles.quantidadeControls}>
              <TouchableOpacity style={styles.qBtn} onPress={() => setQuantidade((q) => Math.max(1, q - 1))}>
                <Feather name="minus" size={18} color="#8D0000" />
              </TouchableOpacity>
              <Text style={styles.quantidadeValor}>{quantidade}</Text>
              <TouchableOpacity style={styles.qBtn} onPress={() => setQuantidade((q) => q + 1)}>
                <Feather name="plus" size={18} color="#8D0000" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.obsLabel}>Observações</Text>
          <TextInput
            style={styles.obsInput}
            placeholder="Ex.: Sem cebola, com borda recheada de cheddar, massa bem assada..."
            placeholderTextColor="#BBB"
            multiline
            value={observacao}
            onChangeText={setObservacao}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.adicionarBtn} onPress={handleAdicionar} activeOpacity={0.85}>
          <Feather name="shopping-cart" size={20} color="#FFF" />
          <Text style={styles.adicionarText}>Adicionar à comanda</Text>
          <Text style={styles.adicionarPreco}>R$ {precoTotal.toFixed(2).replace('.', ',')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarText}>Fechar e voltar ao cardápio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  erroText: { color: '#8D0000', fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backText: { color: '#8D0000', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#8D0000' },

  imagem: { width: '100%', height: 220 },

  content: { padding: 20 },

  nome: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  tempoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  tempoText: { fontSize: 14, color: '#888' },
  descricao: { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 20 },

  combosBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  combosHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  combosTitle: { fontSize: 12, fontWeight: '700', color: '#8D0000', flex: 1 },
  comboNome: { fontSize: 14, color: '#333', marginBottom: 2 },
  verCombos: { color: '#8D0000', fontSize: 13, fontWeight: '600', marginTop: 8 },

  quantidadeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  quantidadeLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  quantidadeControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qBtn: { padding: 6 },
  quantidadeValor: { fontSize: 20, fontWeight: 'bold', color: '#333', minWidth: 28, textAlign: 'center' },

  obsLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 },
  obsInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#EEE',
  },

  footer: { padding: 16, backgroundColor: '#FDF5E6' },
  adicionarBtn: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  adicionarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  adicionarPreco: { color: '#FFF', fontSize: 15, fontWeight: '700', marginRight: 16 },
  voltarBtn: { alignItems: 'center', paddingVertical: 8 },
  voltarText: { color: '#8D0000', fontSize: 14, fontWeight: '500' },
});