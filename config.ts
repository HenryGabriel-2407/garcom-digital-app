import Constants from 'expo-constants';

const getApiUrl = (): string => {
  const hostUri = Constants.manifest?.hostUri || Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8000`;
  }

  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiUrl();