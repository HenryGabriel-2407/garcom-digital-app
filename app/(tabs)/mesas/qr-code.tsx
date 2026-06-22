import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import api from '../../../services/api';

interface Mesa {
  id: number;
  numero: number;
  qtd_lugares: number;
  status: string;
  codigo_qr?: string | null;
}

export default function QrCodeScreen() {
  const router = useRouter();
  const { id: mesaId } = useLocalSearchParams<{ id: string }>();
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Mesa>(`/mesas/${mesaId}`)
      .then(({ data }) => setMesa(data))
      .finally(() => setLoading(false));
  }, [mesaId]);

  const compartilhar = async () => {
    if (!mesa?.codigo_qr) return;
    try {
      await Share.share({
        message: `Escaneie o QR code para acessar a Mesa ${mesa.numero}: ${mesa.codigo_qr}`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#8D0000" /></View>
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
        <Text style={styles.headerTitle}>QR CODE</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.mesaNumero}>Mesa {String(mesa?.numero || '').padStart(2, '0')}</Text>
        <Text style={styles.metaText}>{mesa?.qtd_lugares} lugares</Text>

        <View style={styles.qrContainer}>
          {mesa?.codigo_qr ? (
            <QRCode
              value={mesa.codigo_qr}
              size={220}
              backgroundColor="#FFF"
              color="#8D0000"
            />
          ) : (
            <View style={styles.noQr}>
              <Feather name="smartphone" size={48} color="#CCC" />
              <Text style={styles.noQrText}>QR code não disponível</Text>
            </View>
          )}
        </View>

        <Text style={styles.instructionText}>
          Escaneie o QR code com o celular para acessar o cardápio digital da mesa.
        </Text>

        {mesa?.codigo_qr && (
          <TouchableOpacity style={styles.shareBtn} onPress={compartilhar}>
            <Feather name="share-2" size={18} color="#FFF" />
            <Text style={styles.shareText}>Compartilhar QR Code</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF5E6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
    borderRadius: 24,
    margin: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mesaNumero: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  metaText: { fontSize: 14, color: '#777', marginBottom: 24 },

  qrContainer: {
    width: 240,
    height: 240,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#8D0000',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFF',
  },
  noQr: { alignItems: 'center', gap: 8 },
  noQrText: { color: '#999', fontSize: 13 },

  instructionText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 10,
  },

  shareBtn: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});
