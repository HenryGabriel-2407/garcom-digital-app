// --- IP da sua máquina na rede ---
const LOCAL_IP = '192.168.0.11'; 

const getApiUrl = (): string => {
  return `http://${LOCAL_IP}:8000`;
};

export const API_BASE_URL = getApiUrl();