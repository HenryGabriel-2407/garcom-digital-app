// app/(tabs)/mesas/index.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';


type StatusMesa = 'livre' | 'ocupada' | 'reservada';

interface Mesa {
  id: number;
  numero: number;
  qtd_lugares: number;
  status: StatusMesa;
  codigo_qr?: string | null;
}

type Filtro = 'todos' | StatusMesa;

const STATUS_LABEL: Record<StatusMesa, string> = {
  livre:     'Disponível',
  ocupada:   'Ocupada',
  reservada: 'Reservada',
};

const STATUS_COLOR: Record<StatusMesa, string> = {
  livre:     '#2A3406',
  ocupada:   '#8D0000',
  reservada: '#7B5800',
};

const STATUS_ICON: Record<StatusMesa, keyof typeof Feather.glyphMap> = {
  livre:     'check-circle',
  ocupada:   'x-circle',
  reservada: 'calendar',
};

function MesaCard({ mesa, onAction }: { mesa: Mesa; onAction: (mesa: Mesa) => void }) {
  const router = useRouter();
  const cor = STATUS_COLOR[mesa.status];

  const labelBotao =
    mesa.status === 'livre'     ? 'Iniciar atendimento' :
    mesa.status === 'ocupada'   ? 'Ver comanda'         :
                                  'Confirmar chegada';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          Mesa {String(mesa.numero).padStart(2, '0')}
        </Text>
        <View style={styles.cardHeaderIcons}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(tabs)/mesas/qr-code', params: { id: String(mesa.id) } })}
            style={styles.qrIconBtn}
          >
            <Feather name="smartphone" size={16} color="#8D0000" />
          </TouchableOpacity>
          <Feather name={STATUS_ICON[mesa.status]} size={22} color={cor} />
        </View>
      </View>

      <View style={styles.statusRow}>
        <Feather name={STATUS_ICON[mesa.status]} size={14} color={cor} />
        <Text style={[styles.statusText, { color: cor }]}>
          {STATUS_LABEL[mesa.status]}
        </Text>
      </View>

      <Text style={styles.metaText}>{mesa.qtd_lugares} lugares</Text>

      <TouchableOpacity
        style={[
          styles.actionButton,
          mesa.status === 'reservada' && styles.actionButtonOutline,
        ]}
        onPress={() => onAction(mesa)}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.actionButtonText,
          mesa.status === 'reservada' && styles.actionButtonTextOutline,
        ]}>
          {labelBotao}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const FILTROS: { label: string; value: Filtro }[] = [
  { label: 'TODOS',     value: 'todos'     },
  { label: 'LIVRE',     value: 'livre'     },
  { label: 'OCUPADA',   value: 'ocupada'   },
  { label: 'RESERVADA', value: 'reservada' },
];

export default function MesasScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [mesas, setMesas]           = useState<Mesa[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro]         = useState<Filtro>('todos');
  const [erro, setErro]             = useState('');

  const fetchMesas = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErro('');
    try {
      const { data } = await api.get<Mesa[]>('/mesas/');
      setMesas(data);
    } catch {
      setErro('Não foi possível carregar as mesas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMesas();
    }, [fetchMesas])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMesas(false);
  };

  const mesasFiltradas =
    filtro === 'todos' ? mesas : mesas.filter((m) => m.status === filtro);

  const handleAction = (mesa: Mesa) => {
    if (mesa.status === 'livre') {
      router.navigate({
        pathname: '/mesas/[id]/nova-comanda',
        params: { id: String(mesa.id) },
      });
    } else if (mesa.status === 'ocupada') {
      router.navigate({
        pathname: '/mesas/[id]/comanda',
        params: { id: String(mesa.id) },
      });
    } else if (mesa.status === 'reservada') {
      router.navigate({
        pathname: '/mesas/[id]/confirmar-chegada',
        params: { id: String(mesa.id) },
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.subHeader}>
        <Text style={styles.garcomText}>
          Garçom: {user?.nome?.split(' ')[0] ?? '—'}
        </Text>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabActiveText}>SALÃO (MESAS)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => router.push('/(tabs)/mesas/online')}
          >
            <Text style={styles.tabText}>ONLINE</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtrosRow}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filtro, filtro === f.value && styles.filtroActive]}
            onPress={() => setFiltro(f.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filtroText,
              filtro === f.value && styles.filtroTextActive,
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8D0000" />
        </View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={styles.erroText}>{erro}</Text>
          <TouchableOpacity onPress={() => fetchMesas()} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={mesasFiltradas}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <MesaCard mesa={item} onAction={handleAction} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8D0000"
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhuma mesa encontrada.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, 
    backgroundColor: '#FDF5E6'
  },
  subHeader: { paddingHorizontal: 20, paddingBottom: 4, paddingTop: 8 },
  garcomText: { fontSize: 14, color: '#555', marginBottom: 10 },
  tabs: { flexDirection: 'row', gap: 12 },
  tab: { paddingBottom: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#8D0000' },
  tabText: { fontSize: 13, color: '#999', fontWeight: '600' },
  tabActiveText: { fontSize: 13, color: '#8D0000', fontWeight: '700' },

  filtrosRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filtro: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#EDE0CC',
  },
  filtroActive: { backgroundColor: '#8D0000' },
  filtroText: { fontSize: 12, fontWeight: '600', color: '#555' },
  filtroTextActive: { color: '#FFF' },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrIconBtn: { padding: 4 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusText: { fontSize: 13, fontWeight: '600', marginLeft: 5 },
  metaText: { fontSize: 13, color: '#777', marginBottom: 4 },

  actionButton: {
    backgroundColor: '#8D0000',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    marginHorizontal: 2,
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#8D0000',
  },
  actionButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  actionButtonTextOutline: { color: '#8D0000' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  erroText: { color: '#8D0000', fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: '#FFF', fontWeight: 'bold' },
  emptyText: { fontSize: 15, color: '#999' },
});