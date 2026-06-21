import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface Promocao {
  id: number;
  codigo: string;
  desconto_percentual: number;
  data_validade: string;
  ativo: boolean;
}

export default function AdminPromocoesScreen() {
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Promocao | null>(null);
  const [codigo, setCodigo] = useState('');
  const [desconto, setDesconto] = useState('');
  const [validade, setValidade] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await api.get<Promocao[]>('/promocoes/');
      setPromocoes(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar promoções.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const abrirCriar = () => {
    setEditando(null);
    setCodigo(''); setDesconto(''); setValidade(''); setAtivo(true);
    setModalVisible(true);
  };

  const abrirEditar = (p: Promocao) => {
    setEditando(p);
    setCodigo(p.codigo); setDesconto(String(p.desconto_percentual));
    setValidade(p.data_validade.split('T')[0]); setAtivo(p.ativo);
    setModalVisible(true);
  };

  const salvar = async () => {
    if (!codigo.trim() || !desconto.trim() || !validade.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }
    setSalvando(true);
    try {
      const payload = { codigo: codigo.trim().toUpperCase(), desconto_percentual: parseFloat(desconto), data_validade: validade, ativo };
      if (editando) {
        await api.put(`/promocoes/${editando.id}`, payload);
      } else {
        await api.post('/promocoes/', payload);
      }
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = (p: Promocao) => {
    Alert.alert('Deletar', `Cupom "${p.codigo}" será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar', style: 'destructive',
        onPress: async () => {
          try { await api.delete(`/promocoes/${p.id}`); fetchData(); }
          catch { Alert.alert('Erro', 'Cupom vinculado a comandas.'); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Promoções</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCriar}>
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={promocoes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const expirada = new Date(item.data_validade) < new Date();
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.codigoBox}>
                    <Text style={styles.codigoText}>{item.codigo}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deletar(item)}>
                    <Feather name="trash-2" size={16} color="#CC0000" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.descontoText}>{item.desconto_percentual}% de desconto</Text>
                <View style={styles.cardMeta}>
                  <Text style={[styles.validadeText, expirada && { color: '#CC0000' }]}>
                    {expirada ? 'Expirada' : `Válida até ${new Date(item.data_validade).toLocaleDateString()}`}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: item.ativo && !expirada ? '#2A6B2A' : '#CCC' }]} />
                </View>
                <View style={styles.acoesRow}>
                  <TouchableOpacity onPress={() => abrirEditar(item)} style={styles.acaoBtn}>
                    <Feather name="edit-2" size={14} color="#8D0000" />
                    <Text style={styles.acaoText}>Editar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} />}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>Nenhuma promoção cadastrada.</Text></View>}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editando ? 'Editar Promoção' : 'Nova Promoção'}</Text>
            <Text style={styles.label}>Código</Text>
            <TextInput style={styles.input} value={codigo} onChangeText={setCodigo} autoCapitalize="characters" placeholder="EX: PROMO20" />
            <Text style={styles.label}>Desconto (%)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={desconto} onChangeText={setDesconto} />
            <Text style={styles.label}>Data de validade</Text>
            <TextInput style={styles.input} value={validade} onChangeText={setValidade} placeholder="YYYY-MM-DD" />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Ativo</Text>
              <Switch value={ativo} onValueChange={setAtivo} trackColor={{ true: '#2A6B2A' }} />
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
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codigoBox: { backgroundColor: '#FFF5E6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFD699' },
  codigoText: { fontSize: 16, fontWeight: 'bold', color: '#7B5800', letterSpacing: 1 },
  descontoText: { fontSize: 22, fontWeight: 'bold', color: '#8D0000', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  validadeText: { fontSize: 12, color: '#888' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  acoesRow: { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 8, paddingTop: 8 },
  acaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  acaoText: { fontSize: 12, color: '#8D0000', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, marginTop: 80 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 12, color: '#333' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalBtnCancel: { flex: 1, backgroundColor: '#E0E0E0', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancelText: { color: '#555', fontWeight: '600' },
  modalBtnSave: { flex: 1, backgroundColor: '#8D0000', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnSaveText: { color: '#FFF', fontWeight: 'bold' },
});
