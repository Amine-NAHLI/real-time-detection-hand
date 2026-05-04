export const CONFIG = {
  // Default server IP - change this to your local machine IP
  SERVER_IP: '192.168.1.1', 
  PORT: '8091',
  WS_PATH: '/api/v1/ws/predict',
  get wsUrl() {
    return `ws://${this.SERVER_IP}:${this.PORT}${this.WS_PATH}`;
  }
};
