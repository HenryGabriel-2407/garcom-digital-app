// app/perfil-funcionario/redefinir-senha.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function RedefinirSenhaScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Opcionais para mostrar/ocultar senha
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleUpdatePassword = async () => {
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Endpoint: POST /funcionarios/change-password
      await api.post('/funcionarios/change-password', {
        old_password: currentPassword,
        new_password: newPassword,
      });
      Alert.alert(
        'Senha alterada',
        'Sua senha foi atualizada com sucesso.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        'Erro ao alterar senha. Verifique sua senha atual.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Alterar Senha',
          headerStyle: { backgroundColor: '#FDF5E6' },
          headerTintColor: '#8D0000',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Feather name="shield" size={48} color="#8D0000" style={styles.icon} />
              <Text style={styles.title}>Alterar Senha</Text>
              <Text style={styles.description}>
                Para sua segurança, é recomendável que escolha uma senha forte que você não use em
                outros lugares.
              </Text>

              {/* Campo Senha Atual */}
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color="#8D0000" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Senha Atual"
                  placeholderTextColor="#999"
                  secureTextEntry={!showCurrent}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                  <Feather name={showCurrent ? 'eye-off' : 'eye'} size={20} color="#8D0000" />
                </TouchableOpacity>
              </View>

              {/* Campo Nova Senha */}
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color="#8D0000" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nova Senha"
                  placeholderTextColor="#999"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Feather name={showNew ? 'eye-off' : 'eye'} size={20} color="#8D0000" />
                </TouchableOpacity>
              </View>

              {/* Campo Confirmar Nova Senha */}
              <View style={styles.inputContainer}>
                <Feather name="lock" size={20} color="#8D0000" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar Nova Senha"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Feather name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#8D0000" />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.updateButton, loading && styles.buttonDisabled]}
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.updateButtonText}>ATUALIZAR SENHA</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF5E6',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#8D0000',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    marginBottom: 18,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  updateButton: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  errorText: {
    color: '#8D0000',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});