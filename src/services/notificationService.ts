import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';

export interface NewRecordNotification {
  folio: string;
  rutProveedor: string;
  razonSocial: string;
  montoTotal: number;
  tipoDTE: number;
  tipoDTEString: string;
  fechaEmision: string;
  timestamp: string;
}

class NotificationService {
  private socket: Socket | null = null;
  private connected = ref(false);

  // Reactive state
  public readonly isConnected = this.connected;

  connect() {
    if (this.socket?.connected) return;

    const serverUrl = import.meta.env.DEV
      ? 'http://localhost:3000'
      : 'https://consultassii-api.onrender.com/';

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to notification server');
      this.connected.value = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from notification server');
      this.connected.value = false;
    });

    this.socket.on('new_record', (data: NewRecordNotification) => {
      console.log('New record notification:', data);
      this.showBrowserNotification(data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.connected.value = false;
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected.value = false;
    }
  }

  private async showBrowserNotification(data: NewRecordNotification) {
    console.log('Attempting to show browser notification...', {
      permission: Notification.permission,
      data
    });

    // Request permission if not already granted
    if (Notification.permission === 'default') {
      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
    }

    if (Notification.permission === 'granted') {
      console.log('Permission granted, creating notification...');

      const amount = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
      }).format(data.montoTotal);

      try {
        const notification = new Notification('Nueva Factura Registrada', {
          body: `${data.tipoDTEString} N° ${data.folio}\n${data.razonSocial}\nMonto: ${amount}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `sii-${data.folio}`,
          requireInteraction: false,
          silent: false
        });

        console.log('Notification created successfully:', notification);

        // Auto-close after 8 seconds
        setTimeout(() => {
          notification.close();
        }, 8000);

        // Handle click to focus the window
        notification.onclick = () => {
          console.log('Notification clicked');
          window.focus();
          notification.close();
        };

        notification.onerror = (error) => {
          console.error('Notification error:', error);
        };

        notification.onshow = () => {
          console.log('Notification shown');
        };

        notification.onclose = () => {
          console.log('Notification closed');
        };

      } catch (error) {
        console.error('Error creating notification:', error);
      }
    } else {
      console.warn('Notification permission denied or not supported. Current permission:', Notification.permission);
    }
  }

  // Request browser notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission === 'granted';
  }

  // Test notification function for debugging
  async testNotification() {
    console.log('Testing notification...');
    const testData: NewRecordNotification = {
      folio: '12345',
      rutProveedor: '12345678-9',
      razonSocial: 'Empresa de Prueba',
      montoTotal: 100000,
      tipoDTE: 33,
      tipoDTEString: 'FACTURA ELECTRÓNICA',
      fechaEmision: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    await this.showBrowserNotification(testData);
  }
}

export const notificationService = new NotificationService();
