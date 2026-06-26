import React, {
  createContext,
  useState,
  useContext,
  useEffect,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

type User = {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  telefone: string;
};

type AuthContextData = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextData>(
  {} as AuthContextData
);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  async function loadStoredData() {
    try {
      const token = await AsyncStorage.getItem('@access_token');
      const userData = await AsyncStorage.getItem('@user_data');

      if (token && userData) {
        api.defaults.headers.common[
          'Authorization'
        ] = `Bearer ${token}`;

        setUser(JSON.parse(userData));

      }
    } catch (error) {
      console.error('Erro ao carregar sessão:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
  try {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = response.data;
    if (!access_token) throw new Error('Token não recebido');

    // Salva token ANTES de usar
    await AsyncStorage.setItem('@access_token', access_token);

    // Configura o header padrão
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    // Agora o interceptor encontrará o token no storage
    const meResponse = await api.get('/funcionarios/me');
    const userData = meResponse.data;

    await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
    setUser(userData);

    console.log('Login realizado com sucesso');
  } catch (error: any) {
    console.error('Erro no login:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Erro no login');
  }
}

  async function signOut() {
    try {
      await AsyncStorage.removeItem(
        '@access_token'
      );

      await AsyncStorage.removeItem(
        '@user_data'
      );

      delete api.defaults.headers.common[
        'Authorization'
      ];

      setUser(null);

      console.log('Logout realizado');
    } catch (error) {
      console.error(
        'Erro ao realizar logout:',
        error
      );
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};