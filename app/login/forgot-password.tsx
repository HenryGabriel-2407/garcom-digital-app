// app/login/forgot-password.tsx
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Por favor, insira seu e-mail');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });

      Alert.alert(
        'Código enviado',
        'Um código de verificação foi enviado para o e-mail informado.',
        [
          {
            text: 'OK',
            onPress: () => router.push({
              pathname: '/login/reset-password',
              params: { email: email.trim() }
            }),
          },
        ]
      );
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        'Erro ao solicitar recuperação. Verifique o e-mail e tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/forgot_password.jpeg')}
          style={styles.icon}
          resizeMode="contain"
        />

        {/* Título */}
        <Text style={styles.title}>Recuperar Senha</Text>

        {/* Subtítulo */}
        <Text style={styles.subtitle}>Esqueceu a senha?</Text>

        {/* Descrição */}
        <Text style={styles.description}>
          Insira seu e-mail cadastrado para receber o código de verificação.
        </Text>

        {/* Campo de e-mail */}
        <View style={styles.inputContainer}>
          <Feather name="mail" size={20} color="#8D0000" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
            editable={!loading}
          />
        </View>

        {/* Mensagem de erro */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Botão enviar código */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendCode}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>ENVIAR CÓDIGO</Text>
          )}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    width: 80,
    height: 80,
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
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
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