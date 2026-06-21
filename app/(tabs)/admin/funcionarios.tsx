import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface Funcionario {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  telefone?: string;
  ativo: boolean;
  data_contratacao: string;
}

const CARGOS = ['garcom', 'cozinha', 'admin', 'gerente'];

export default function AdminFuncionariosScreen() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('garcom');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await api.get<Funcionario[]>('/funcionarios/');
      setFuncionarios(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar funcionários.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const abrirCriar = () => {
    setEditando(null);
    setNome(''); setEmail(''); setSenha(''); setCargo('garcom'); setTelefone('');
    setModalVisible(true);
  };

  const abrirEditar = (f: Funcionario) => {
    setEditando(f);
    setNome(f.nome); setEmail(f.email); setSenha(''); setCargo(f.cargo); setTelefone(f.telefone || '');
    setModalVisible(true);
  };

  const salvar = async () => {
    if (!nome.trim() || !email.trim() || (!editando && !senha.trim())) {
      Alert.alert('Erro', 'Nome, email e senha são obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      const payload: Record<string, any> = { nome: nome.trim(), email: email.trim(), cargo, telefone: telefone.trim() || null };
      if (senha.trim()) payload.senha = senha.trim();
      if (editando) {
        await api.put(`/funcionarios/${editando.id}`, payload);
      } else {
        await api.post('/funcionarios/', payload);
      }
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = (f: Funcionario) => {
    const acao = f.ativo ? 'desativar' : 'ativar';
    Alert.alert(`${acao === 'ativar' ? 'Ativar' : 'Desativar'}`, `Tem certeza?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim',
        onPress: async () => {
          try { await api.post(`/funcionarios/${f.id}/${acao}`); fetchData(); }
          catch { Alert.alert('Erro', 'Falha ao alterar.'); }
        },
      },
    ]);
  };

  const getCargoColor = (c: string) => {
    const map: Record<string, string> = { garcom: '#8D0000', cozinha: '#E68A00', admin: '#2A6B2A', gerente: '#7B5800' };
    return map[c] || '#555';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Funcionários</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirCriar}>
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={funcionarios}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text></View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardNome}>{item.nome}</Text>
                  <Text style={styles.cardEmail}>{item.email}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleAtivo(item)}>
                  <Feather name={item.ativo ? 'toggle-left' : 'toggle-right'} size={28} color={item.ativo ? '#2A6B2A' : '#CCC'} />
                </TouchableOpacity>
              </View>
              <View style={styles.cardMetaRow}>
                <View style={[styles.cargoBadge, { backgroundColor: getCargoColor(item.cargo) + '20' }]}>
                  <Text style={[styles.cargoText, { color: getCargoColor(item.cargo) }]}>{item.cargo.toUpperCase()}</Text>
                </View>
                {item.telefone && <Text style={styles.metaText}>📞 {item.telefone}</Text>}
                <Text style={styles.metaText}>📅 {new Date(item.data_contratacao).toLocaleDateString()}</Text>
              </View>
              <View style={styles.acoesRow}>
                <TouchableOpacity onPress={() => abrirEditar(item)} style={styles.acaoBtn}>
                  <Feather name="edit-2" size={14} color="#8D0000" />
                  <Text style={styles.acaoText}>Editar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} />}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editando ? 'Editar Funcionário' : 'Novo Funcionário'}</Text>
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={nome} onChangeText={setNome} />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.label}>{editando ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</Text>
            <TextInput style={styles.input} value={senha} onChangeText={setSenha} secureTextEntry />
            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} />
            <Text style={styles.label}>Cargo</Text>
            <View style={styles.cargoRow}>
              {CARGOS.map((c) => (
                <TouchableOpacity key={c} style={[styles.cargoBtn, cargo === c && styles.cargoBtnActive]} onPress={() => setCargo(c)}>
                  <Text style={[styles.cargoBtnText, cargo === c && styles.cargoBtnTextActive]}>{c.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
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
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8D0000', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 15, fontWeight: '600', color: '#333' },
  cardEmail: { fontSize: 13, color: '#888' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginLeft: 52 },
  cargoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  cargoText: { fontSize: 10, fontWeight: '700' },
  metaText: { fontSize: 12, color: '#888' },
  acoesRow: { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 10, paddingTop: 8, marginLeft: 52 },
  acaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  acaoText: { fontSize: 12, color: '#8D0000', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, marginTop: 60 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 12, color: '#333' },
  cargoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  cargoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#EDE0CC' },
  cargoBtnActive: { backgroundColor: '#8D0000' },
  cargoBtnText: { fontSize: 12, fontWeight: '600', color: '#555' },
  cargoBtnTextActive: { color: '#FFF' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalBtnCancel: { flex: 1, backgroundColor: '#E0E0E0', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancelText: { color: '#555', fontWeight: '600' },
  modalBtnSave: { flex: 1, backgroundColor: '#8D0000', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnSaveText: { color: '#FFF', fontWeight: 'bold' },
});
