import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8D0000" />
      </View>
    );
  }

  // Se não autenticado, redireciona para login (segurança extra)
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Se autenticado, vai para a tela de perfil do funcionário
  return <Redirect href="/perfil-funcionario" />;
}