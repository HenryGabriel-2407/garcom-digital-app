// app/login/verificar-codigo-acesso.tsx
import React, { useState, useRef } from 'react';
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
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';

export default function VerifyCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Função para lidar com mudança em cada dígito
  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) return; // Aceita apenas 1 dígito por vez

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    setError('');

    // Auto-focus no próximo campo
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Função para lidar com backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Função para verificar o código
  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Por favor, insira o código de 6 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Supondo endpoint: POST /auth/verify-code { email, code }
      await api.post('/auth/verify-code', {
        email,
        code: fullCode,
      });

      // Código válido, navega para a tela de redefinição de senha
      router.push({
        pathname: '/login/reset-password',
        params: { email, code: fullCode },
      });
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        'Código inválido ou expirado. Tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Função para reenviar código
  const handleResendCode = async () => {
    if (!email) {
      Alert.alert('Erro', 'E-mail não informado. Volte para a tela anterior.');
      return;
    }

    setResending(true);
    try {
      // Supondo endpoint: POST /auth/resend-code { email }
      await api.post('/auth/resend-code', { email });
      Alert.alert(
        'Código reenviado',
        'Um novo código de verificação foi enviado para seu e-mail.'
      );
      // Limpar campos de código após reenvio (opcional)
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert(
        'Erro',
        err.response?.data?.detail || 'Não foi possível reenviar o código.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color="#8D0000" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Feather name="mail" size={64} color="#8D0000" style={styles.icon} />
        <Text style={styles.title}>Verificar Código</Text>
        <Text style={styles.subtitle}>Confirme seu e-mail</Text>
        <Text style={styles.description}>
          Enviamos um código de 6 dígitos para o seu e-mail. Por favor, insira-o abaixo para continuar.
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.codeInput, digit && styles.codeInputFilled]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              editable={!loading}
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.verifyButtonText}>VERIFICAR</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Não recebeu o código? </Text>
          <TouchableOpacity onPress={handleResendCode} disabled={resending}>
            <Text style={styles.resendLink}>
              {resending ? 'Enviando...' : 'Reenviar código'}
            </Text>
          </TouchableOpacity>
        </View>
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
  description: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  codeInput: {
    backgroundColor: '#FFF',
    width: 48,
    height: 56,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    borderWidth: 1,
    borderColor: '#DDD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  codeInputFilled: {
    borderColor: '#8D0000',
    borderWidth: 2,
  },
  verifyButton: {
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
  verifyButtonText: {
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
  resendContainer: {
    flexDirection: 'row',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#555',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8D0000',
  },
});