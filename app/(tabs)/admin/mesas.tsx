import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface Mesa {
  id: number;
  numero: number;
  qtd_lugares: number;
  status: string;
  codigo_qr?: string | null;
}

export default function AdminMesasScreen() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Mesa | null>(null);
  const [numero, setNumero] = useState('');
  const [lugares, setLugares] = useState('4');
  const [salvando, setSalvando] = useState(false);

  const fetchMesas = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await api.get<Mesa[]>('/mesas/');
      setMesas(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar mesas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchMesas(); }, [fetchMesas]));

  const abrirCriar = () => {
    setEditando(null);
    setNumero('');
    setLugares('4');
    setModalVisible(true);
  };

  const abrirEditar = (m: Mesa) => {
    setEditando(m);
    setNumero(String(m.numero));
    setLugares(String(m.qtd_lugares));
    setModalVisible(true);
  };

  const salvar = async () => {
    const num = parseInt(numero, 10);
    const qtd = parseInt(lugares, 10);
    if (isNaN(num) || isNaN(qtd) || qtd < 1) {
      Alert.alert('Erro', 'Informe número e quantidade de lugares válidos.');
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/mesas/${editando.id}`, { numero: num, qtd_lugares: qtd });
      } else {
        await api.post('/mesas/', { numero: num, qtd_lugares: qtd });
      }
      setModalVisible(false);
      fetchMesas();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao salvar mesa.');
    } finally {
      setSalvando(false);
    }
  };

  const deletar = (m: Mesa) => {
    Alert.alert('Deletar mesa', `Mesa ${m.numero} será removida. Tem certeza?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/mesas/${m.id}`);
            fetchMesas();
          } catch {
            Alert.alert('Erro', 'Não foi possível deletar. A mesa pode ter comandas vinculadas.');
          }
        },
      },
    ]);
  };

  const mudarStatus = (m: Mesa, novoStatus: string) => {
    Alert.alert('Alterar status', `Mudar para "${novoStatus}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim',
        onPress: async () => {
          try {
            await api.post(`/mesas/${m.id}/${novoStatus}`, {});
            fetchMesas();
          } catch {
            Alert.alert('Erro', 'Falha ao alterar status.');
          }
        },
      },
    ]);
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = { livre: 'Livre', ocupada: 'Ocupada', reservada: 'Reservada' };
    return map[s] || s;
  };

  const getStatusColor = (s: string) => {
    const map: Record<string, string> = { livre: '#2A6B2A', ocupada: '#8D0000', reservada: '#7B5800' };
    return map[s] || '#555';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mesas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCriar}>
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={mesas}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.mesaNumero}>Mesa {String(item.numero).padStart(2, '0')}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.metaText}>{item.qtd_lugares} lugares</Text>
              {item.codigo_qr && <Text style={styles.qrText}>QR: {item.codigo_qr.slice(0, 30)}...</Text>}

              <View style={styles.acoesRow}>
                <TouchableOpacity style={styles.acaoBtn} onPress={() => abrirEditar(item)}>
                  <Feather name="edit-2" size={14} color="#8D0000" />
                  <Text style={styles.acaoText}>Editar</Text>
                </TouchableOpacity>
                {item.status === 'livre' && (
                  <TouchableOpacity style={styles.acaoBtn} onPress={() => mudarStatus(item, 'reservar')}>
                    <Feather name="calendar" size={14} color="#7B5800" />
                    <Text style={[styles.acaoText, { color: '#7B5800' }]}>Reservar</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'ocupada' && (
                  <TouchableOpacity style={styles.acaoBtn} onPress={() => mudarStatus(item, 'liberar')}>
                    <Feather name="check" size={14} color="#2A6B2A" />
                    <Text style={[styles.acaoText, { color: '#2A6B2A' }]}>Liberar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.acaoBtn} onPress={() => deletar(item)}>
                  <Feather name="trash-2" size={14} color="#CC0000" />
                  <Text style={[styles.acaoText, { color: '#CC0000' }]}>Deletar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMesas(false); }} />}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editando ? 'Editar Mesa' : 'Nova Mesa'}</Text>

            <Text style={styles.label}>Número da mesa</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={numero} onChangeText={setNumero} />

            <Text style={styles.label}>Quantidade de lugares</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={lugares} onChangeText={setLugares} />

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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  mesaNumero: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  metaText: { fontSize: 13, color: '#888' },
  qrText: { fontSize: 10, color: '#BBB', marginTop: 2 },
  acoesRow: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  acaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  acaoText: { fontSize: 12, color: '#8D0000', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalBtnCancel: { flex: 1, backgroundColor: '#E0E0E0', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancelText: { color: '#555', fontWeight: '600' },
  modalBtnSave: { flex: 1, backgroundColor: '#8D0000', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnSaveText: { color: '#FFF', fontWeight: 'bold' },
});
