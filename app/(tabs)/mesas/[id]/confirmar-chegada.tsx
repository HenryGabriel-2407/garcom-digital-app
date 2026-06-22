import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../services/api';

interface Mesa {
  id: number;
  numero: number;
  qtd_lugares: number;
  status: string;
  codigo_qr?: string | null;
}

export default function ConfirmarChegadaScreen() {
  const router = useRouter();
  const { id: mesaId } = useLocalSearchParams<{ id: string }>();

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    api.get<Mesa>(`/mesas/${mesaId}`)
      .then(({ data }) => setMesa(data))
      .catch(() => Alert.alert('Erro', 'Não foi possível carregar a mesa.'))
      .finally(() => setLoading(false));
  }, [mesaId]);

  const handleConfirmar = async () => {
    if (!mesa) return;
    setConfirmando(true);
    try {
      await api.post(`/mesas/${mesa.id}/ocupar`);
      Alert.alert('Sucesso', 'Chegada confirmada! Mesa ocupada com sucesso.', [
        {
          text: 'Ir para Nova Comanda',
          onPress: () => router.replace({
            pathname: '/(tabs)/mesas/[id]/nova-comanda',
            params: { id: mesaId },
          }),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Falha ao confirmar chegada.');
    } finally {
      setConfirmando(false);
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

  if (!mesa) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color="#8D0000" />
          <Text style={styles.erroText}>Mesa não encontrada.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
            <Text style={styles.voltarText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#8D0000" />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CONFIRMAR CHEGADA</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Feather name="calendar" size={48} color="#7B5800" />
        </View>
        <Text style={styles.mesaNumero}>Mesa {String(mesa.numero).padStart(2, '0')}</Text>
        <Text style={styles.metaText}>{mesa.qtd_lugares} lugares</Text>

        <View style={styles.statusBadge}>
          <Feather name="clock" size={14} color="#7B5800" />
          <Text style={styles.statusText}>RESERVADA</Text>
        </View>

        <Text style={styles.description}>
          O cliente chegou? Confirme a presença para liberar a mesa e iniciar o atendimento.
        </Text>

        <TouchableOpacity
          style={[styles.confirmarBtn, confirmando && { opacity: 0.7 }]}
          onPress={handleConfirmar}
          disabled={confirmando}
          activeOpacity={0.85}
        >
          {confirmando ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#FFF" />
              <Text style={styles.confirmarText}>Confirmar chegada do cliente</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.liberarBtn}
          onPress={() => {
            Alert.alert('Liberar mesa', 'Tem certeza? A reserva será cancelada.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Liberar',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.post(`/mesas/${mesa.id}/liberar`);
                    Alert.alert('Sucesso', 'Mesa liberada!', [
                      { text: 'OK', onPress: () => router.replace('/(tabs)/mesas') },
                    ]);
                  } catch {
                    Alert.alert('Erro', 'Falha ao liberar mesa.');
                  }
                },
              },
            ]);
          }}
        >
          <Text style={styles.liberarText}>Mesa não será ocupada — Liberar mesa</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  erroText: { fontSize: 16, color: '#8D0000', marginTop: 12 },
  voltarBtn: { marginTop: 20, backgroundColor: '#8D0000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30 },
  voltarText: { color: '#FFF', fontWeight: 'bold' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80 },
  backText: { color: '#8D0000', fontSize: 14, fontWeight: '600', marginLeft: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#8D0000' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    margin: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mesaNumero: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  metaText: { fontSize: 15, color: '#777', marginBottom: 16 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusText: { fontSize: 13, fontWeight: '700', color: '#7B5800' },
  description: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmarBtn: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  confirmarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  liberarBtn: { paddingVertical: 8 },
  liberarText: { color: '#999', fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
});
