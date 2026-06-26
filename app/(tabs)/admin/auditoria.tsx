import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api';

interface AuditLog {
  id: number;
  usuario_tipo: string;
  usuario_id: number | null;
  acao: string;
  tabela_afetada?: string;
  registro_id?: number;
  timestamp: string;
  ip?: string;
  user_agent?: string;
  dados_anteriores?: any;
  dados_novos?: any;
  funcionario_rel?: { nome: string } | null;
}

export default function AdminAuditoriaScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await api.get<AuditLog[]>('/audit-logs/');
      setLogs(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const getAcaoColor = (acao: string) => {
    if (acao.includes('cria') || acao.includes('Cria')) return '#2A6B2A';
    if (acao.includes('atualiza') || acao.includes('Atualiza')) return '#E68A00';
    if (acao.includes('deleta') || acao.includes('Deleta')) return '#CC0000';
    return '#555';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Auditoria</Text>
        <TouchableOpacity onPress={() => fetchData()}>
          <Feather name="refresh-cw" size={20} color="#8D0000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.acaoBadge, { backgroundColor: getAcaoColor(item.acao) + '20' }]}>
                  <Text style={[styles.acaoText, { color: getAcaoColor(item.acao) }]}>{item.acao.toUpperCase()}</Text>
                </View>
                <Text style={styles.tabelaText}>{item.tabela_afetada || '—'}</Text>
              </View>

              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>
                  👤 {item.funcionario_rel?.nome || `${item.usuario_tipo} #${item.usuario_id || '?'}`}
                </Text>
                <Text style={styles.metaText}>🆔 Registro #{item.registro_id || '—'}</Text>
                <Text style={styles.metaText}>🕐 {new Date(item.timestamp).toLocaleString()}</Text>
              </View>

              {(item.dados_anteriores || item.dados_novos) && (
                <View style={styles.dadosBox}>
                  {item.dados_anteriores && (
                    <Text style={styles.dadosAntes}>
                      Antes: {JSON.stringify(item.dados_anteriores).slice(0, 120)}
                    </Text>
                  )}
                  {item.dados_novos && (
                    <Text style={styles.dadosDepois}>
                      Depois: {JSON.stringify(item.dados_novos).slice(0, 120)}
                    </Text>
                  )}
                </View>
              )}

              {item.ip && <Text style={styles.ipText}>🌐 {item.ip}</Text>}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} tintColor="#8D0000" />}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>Nenhum log encontrado.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  acaoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  acaoText: { fontSize: 10, fontWeight: '700' },
  tabelaText: { fontSize: 13, color: '#555', fontWeight: '600' },
  cardMeta: { gap: 2, marginBottom: 8 },
  metaText: { fontSize: 12, color: '#888' },
  dadosBox: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 8, marginBottom: 4 },
  dadosAntes: { fontSize: 11, color: '#CC0000', marginBottom: 2 },
  dadosDepois: { fontSize: 11, color: '#2A6B2A' },
  ipText: { fontSize: 11, color: '#BBB', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },
});
