import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../../services/api';

interface ProdutoCombo {
  id: number;
  nome: string;
}

interface Combo {
  id: number;
  nome: string;
  descricao?: string;
  imagem_link: string;
  preco: number;
  tempo_preparo_medio?: number;
  popular: boolean;
  disponivel: boolean;
  produtos?: ProdutoCombo[];
}

export default function ComboDetalheScreen() {
  const router = useRouter();
  const { id: mesaId, comboId, comandaId } = useLocalSearchParams<{
    id: string;
    comboId: string;
    comandaId?: string;
  }>();

  const [combo, setCombo] = useState<Combo | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    api.get<Combo>(`/combos/${comboId}`)
      .then(({ data }) => setCombo(data))
      .finally(() => setLoading(false));
  }, [comboId]);

  const handleAdicionar = async () => {
    if (!combo) return;

    if (comandaId) {
      try {
        await api.post(`/comandas/${comandaId}/itens`, {
          id_produto: undefined,
          id_combo: combo.id,
          quantidade,
          observacao: observacao.trim() || null,
        });
        Alert.alert('Sucesso', 'Combo adicionado à comanda!');
        router.replace(`/(tabs)/mesas/${mesaId}/comanda`);
      } catch (err: any) {
        Alert.alert('Erro', err.response?.data?.detail || 'Falha ao adicionar combo.');
      }
    } else {
      router.push({
        pathname: `/(tabs)/mesas/${mesaId}/nova-comanda`,
        params: {
          tipo: 'combo',
          itemId: String(combo.id),
          nome: combo.nome,
          preco: String(combo.preco),
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

  if (!combo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.erroText}>Combo não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const precoTotal = combo.preco * quantidade;

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
        <Image source={{ uri: combo.imagem_link }} style={styles.imagem} resizeMode="cover" />
        <View style={styles.content}>
          <View style={styles.tituloRow}>
            <Text style={styles.nome}>{combo.nome}</Text>
            {combo.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>⭐ Popular</Text>
              </View>
            )}
          </View>

          {combo.tempo_preparo_medio != null && (
            <View style={styles.tempoRow}>
              <Feather name="clock" size={14} color="#888" />
              <Text style={styles.tempoText}>{combo.tempo_preparo_medio} min</Text>
            </View>
          )}

          {combo.descricao && (
            <Text style={styles.descricao}>{combo.descricao}</Text>
          )}

          {combo.produtos && combo.produtos.length > 0 && (
            <View style={styles.produtosBox}>
              <View style={styles.produtosHeader}>
                <Feather name="box" size={16} color="#8D0000" />
                <Text style={styles.produtosTitle}>PRODUTOS INCLUÍDOS NESTE COMBO:</Text>
              </View>
              {combo.produtos.map((p) => (
                <View key={p.id} style={styles.produtoRow}>
                  <Feather name="check" size={14} color="#2A6B2A" />
                  <Text style={styles.produtoNome}>{p.nome}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.precoBox}>
            <Text style={styles.precoLabel}>Preço do combo</Text>
            <Text style={styles.precoValor}>R$ {combo.preco.toFixed(2).replace('.', ',')}</Text>
          </View>

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
            placeholder="Ex.: Sem cebola, com borda recheada..."
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

  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  nome: { fontSize: 22, fontWeight: 'bold', color: '#333', flex: 1 },
  popularBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularText: { fontSize: 11, color: '#8D6000', fontWeight: '600' },

  tempoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  tempoText: { fontSize: 14, color: '#888' },
  descricao: { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 20 },

  produtosBox: {
    backgroundColor: '#F0FFF0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CCEECC',
  },
  produtosHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  produtosTitle: { fontSize: 12, fontWeight: '700', color: '#2A6B2A', flex: 1 },
  produtoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  produtoNome: { fontSize: 14, color: '#333' },

  precoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  precoLabel: { fontSize: 14, fontWeight: '600', color: '#555' },
  precoValor: { fontSize: 20, fontWeight: 'bold', color: '#8D0000' },

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
