// app/login/index.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  TouchableWithoutFeedback, Keyboard, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha e-mail e senha');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password.trim());
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Falha no login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/login/forgot-password');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Logo da pizzaria */}
          <Image
            source={require('../../assets/images/Logo Pizzaria.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.subtitle}>GARÇOM DIGITAL</Text>
          <Text style={styles.accessText}>Acesso exclusivo para colaboradores</Text>

          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color="#8D0000" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color="#8D0000" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              editable={!loading}
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Esqueci a senha</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.loginButton, (loading || authLoading) && styles.loginButtonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading || authLoading}
          >
            {loading || authLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>ENTRAR</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
  logo: {
    width: 250,
    height: 250,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#8D0000',
    textAlign: 'center',
    marginBottom: 8,
  },
  accessText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 48,
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
  forgotText: {
    color: '#8D0000',
    fontSize: 14,
    fontWeight: '500',
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#8D0000',
    borderRadius: 30,
    height: 54,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
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