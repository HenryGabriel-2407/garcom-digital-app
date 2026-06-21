import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, Switch, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

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
  id_categoria: number;
  tempo_preparo_medio?: number;
  popular: boolean;
  disponivel: boolean;
  categoria_rel?: Categoria;
}

export default function AdminProdutosScreen() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [imagem, setImagem] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [tempoPreparo, setTempoPreparo] = useState('');
  const [popular, setPopular] = useState(false);
  const [disponivel, setDisponivel] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [resProdutos, resCategorias] = await Promise.all([
        api.get<Produto[]>('/produtos/'),
        api.get<Categoria[]>('/categorias/'),
      ]);
      setProdutos(resProdutos.data);
      setCategorias(resCategorias.data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const abrirCriar = () => {
    setEditando(null);
    setNome(''); setDescricao(''); setPreco(''); setImagem('');
    setCategoriaId(categorias[0]?.id || null);
    setTempoPreparo(''); setPopular(false); setDisponivel(true);
    setModalVisible(true);
  };

  const abrirEditar = (p: Produto) => {
    setEditando(p);
    setNome(p.nome); setDescricao(p.descricao); setPreco(String(p.preco));
    setImagem(p.imagem_link); setCategoriaId(p.id_categoria);
    setTempoPreparo(String(p.tempo_preparo_medio || ''));
    setPopular(p.popular); setDisponivel(p.disponivel);
    setModalVisible(true);
  };

  const salvar = async () => {
    if (!nome.trim() || !preco.trim()) {
      Alert.alert('Erro', 'Nome e preço são obrigatórios.');
      return;
    }
    setSalvando(true);
    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      imagem_link: imagem.trim() || 'https://via.placeholder.com/200',
      preco: parseFloat(preco.replace(',', '.')),
      id_categoria: categoriaId || categorias[0]?.id,
      tempo_preparo_medio: tempoPreparo ? parseInt(tempoPreparo, 10) : null,
      popular,
      disponivel,
    };
    try {
      if (editando) {
        await api.put(`/produtos/${editando.id}`, payload);
      } else {
        await api.post('/produtos/', payload);
      }
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = (p: Produto) => {
    Alert.alert('Deletar produto', `"${p.nome}" será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar', style: 'destructive',
        onPress: async () => {
          try { await api.delete(`/produtos/${p.id}`); fetchData(); }
          catch { Alert.alert('Erro', 'Produto vinculado a combos.'); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Produtos</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCriar}>
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={produtos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.imagem_link }} style={styles.cardImage} />
              <View style={styles.cardInfo}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardNome} numberOfLines={1}>{item.nome}</Text>
                  {item.popular && <Text style={styles.popularBadge}>⭐</Text>}
                </View>
                <Text style={styles.cardCategoria}>{item.categoria_rel?.nome || 'Sem categoria'}</Text>
                <Text style={styles.cardPreco}>R$ {item.preco.toFixed(2).replace('.', ',')}</Text>
                <View style={styles.cardStatus}>
                  <View style={[styles.statusDot, { backgroundColor: item.disponivel ? '#2A6B2A' : '#CC0000' }]} />
                  <Text style={styles.cardStatusText}>{item.disponivel ? 'Disponível' : 'Indisponível'}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => abrirEditar(item)}><Feather name="edit-2" size={16} color="#8D0000" /></TouchableOpacity>
                <TouchableOpacity onPress={() => deletar(item)}><Feather name="trash-2" size={16} color="#CC0000" /></TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} />}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editando ? 'Editar Produto' : 'Novo Produto'}</Text>

              <Text style={styles.label}>Nome *</Text>
              <TextInput style={styles.input} value={nome} onChangeText={setNome} />

              <Text style={styles.label}>Descrição</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={descricao} onChangeText={setDescricao} multiline />

              <Text style={styles.label}>Preço *</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={preco} onChangeText={setPreco} />

              <Text style={styles.label}>URL da imagem</Text>
              <TextInput style={styles.input} value={imagem} onChangeText={setImagem} placeholder="https://..." />

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.catRow}>
                {categorias.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catBtn, categoriaId === c.id && styles.catBtnActive]}
                    onPress={() => setCategoriaId(c.id)}
                  >
                    <Text style={[styles.catBtnText, categoriaId === c.id && styles.catBtnTextActive]}>{c.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Tempo de preparo (min)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={tempoPreparo} onChangeText={setTempoPreparo} />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Popular</Text>
                <Switch value={popular} onValueChange={setPopular} trackColor={{ true: '#8D0000' }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Disponível</Text>
                <Switch value={disponivel} onValueChange={setDisponivel} trackColor={{ true: '#2A6B2A' }} />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel}>
                  <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={salvar} style={styles.modalBtnSave} disabled={salvando}>
                  {salvando ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalBtnSaveText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#8D0000', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 10, alignItems: 'center' },
  cardImage: { width: 56, height: 56, borderRadius: 10, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardNome: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  popularBadge: { fontSize: 14 },
  cardCategoria: { fontSize: 12, color: '#888', marginTop: 2 },
  cardPreco: { fontSize: 14, fontWeight: '700', color: '#8D0000', marginTop: 2 },
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  cardStatusText: { fontSize: 11, color: '#888' },
  cardActions: { gap: 12, marginLeft: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalScroll: { flex: 1 },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, marginTop: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 14, color: '#333' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#EDE0CC' },
  catBtnActive: { backgroundColor: '#8D0000' },
  catBtnText: { fontSize: 12, fontWeight: '600', color: '#555' },
  catBtnTextActive: { color: '#FFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  modalBtnCancel: { flex: 1, backgroundColor: '#E0E0E0', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancelText: { color: '#555', fontWeight: '600' },
  modalBtnSave: { flex: 1, backgroundColor: '#8D0000', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnSaveText: { color: '#FFF', fontWeight: 'bold' },
});
