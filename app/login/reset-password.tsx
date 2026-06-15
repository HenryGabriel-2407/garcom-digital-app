// app/login/reset-password.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!code || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', {
        email,
        token: code,
        new_password: newPassword,
      });
      Alert.alert('Sucesso', 'Senha redefinida. Faça login com a nova senha.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao redefinir senha. Verifique o código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color="#8D0000" />
      </TouchableOpacity>
      <View style={styles.content}>
        <Feather name="lock" size={64} color="#8D0000" style={styles.icon} />
        <Text style={styles.title}>Redefinir Senha</Text>
        <Text style={styles.subtitle}>Digite o código e a nova senha</Text>

        <View style={styles.inputContainer}>
          <Feather name="key" size={20} color="#8D0000" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Código (6 dígitos)" value={code} onChangeText={setCode} keyboardType="number-pad" />
        </View>

        <View style={styles.inputContainer}>
          <Feather name="lock" size={20} color="#8D0000" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Nova senha" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        </View>

        <View style={styles.inputContainer}>
          <Feather name="lock" size={20} color="#8D0000" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Confirmar nova senha" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>REDEFINIR SENHA</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF5E6',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8D0000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8D0000',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    width: '100%',
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  button: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    height: 54,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
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
    width: '100%',
  },
});