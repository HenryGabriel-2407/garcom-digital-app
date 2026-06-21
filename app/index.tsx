import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user} = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.cargo === 'cozinha') {
    return <Redirect href="/(tabs)/cozinha" />;
  }

  if (user.cargo === 'admin' || user.cargo === 'gerente') {  // A especificar melhor, mas a priori já é suficiente
    return <Redirect href="/(tabs)/admin" />;
  }

  return <Redirect href="/(tabs)/mesas" />;
}
