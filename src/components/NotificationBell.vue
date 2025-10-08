<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { notificationService } from '@/services/notificationService';
import NotificationBellIcon from '@/assets/icons/notificationbell.svg';

const showStatus = ref(false);
const hasPermission = ref(Notification.permission === 'granted');
const currentPermission = ref(Notification.permission);
const isConnected = computed(() => notificationService.isConnected.value);

const togglePermission = () => {
  showStatus.value = !showStatus.value;
};

const requestPermission = async () => {
  const granted = await notificationService.requestNotificationPermission();
  hasPermission.value = granted;
  currentPermission.value = Notification.permission;
  if (granted) {
    showStatus.value = false;
  }
};

const testNotification = async () => {
  await notificationService.testNotification();
};

const getTooltip = () => {
  if (!isConnected.value) return 'Desconectado del servidor';
  if (!hasPermission.value) return 'Click para habilitar notificaciones';
  return 'Notificaciones activas';
};

onMounted(() => {
  notificationService.connect();
});

onUnmounted(() => {
  notificationService.disconnect();
});
</script>

<template>
  <div class="notification-bell">
    <button
      @click="togglePermission"
      class="bell-button"
      :class="{ 'connected': isConnected, 'disconnected': !isConnected }"
      :title="getTooltip()"
    >
      <img :src="NotificationBellIcon" alt="Notification Bell" class="bell-icon" />
      <span class="connection-dot" :class="{ 'connected': isConnected }"></span>
    </button>

    <!-- Simple status indicator -->
    <div v-if="showStatus" class="status-popup">
      <div class="status-content">
        <p><strong>Estado de Notificaciones</strong></p>
        <p>Conexión: {{ isConnected ? '✅ Conectado' : '❌ Desconectado' }}</p>
        <p>Navegador: {{ hasPermission ? '✅ Habilitado' : '❌ Deshabilitado' }}</p>
        <p><small>Permiso actual: {{ currentPermission }}</small></p>

        <div class="button-group">
          <button v-if="!hasPermission" @click="requestPermission" class="enable-btn">
            Habilitar Notificaciones
          </button>
          <button @click="testNotification" class="test-btn" :disabled="!hasPermission">
            🧪 Probar Notificación
          </button>
          <button @click="showStatus = false" class="close-btn">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
}

.bell-button {
  position: relative;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
}

.bell-button:hover {
  background: rgba(108, 117, 125, 0.1);
  transform: translateY(-1px);
}

.bell-button.connected:hover {
  background: rgba(40, 167, 69, 0.1);
}

.bell-button.disconnected:hover {
  background: rgba(220, 53, 69, 0.1);
}

.bell-icon {
  font-size: 1.1rem;
  color: #6c757d;
  transition: all 0.2s ease;
}

.bell-button:hover .bell-icon {
  transform: rotate(15deg);
  color: #495057;
}

.bell-button.connected .bell-icon {
  color: #28a745;
}

.bell-button.disconnected .bell-icon {
  color: #dc3545;
}

.connection-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #dc3545;
  border: 2px solid white;
  transition: background-color 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.connection-dot.connected {
  background: #28a745;
}

.status-popup {
  position: absolute;
  top: 100%;
  right: 0;
  width: 300px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 0.5rem;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-content {
  padding: 1.5rem;
}

.status-content p {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.enable-btn, .test-btn, .close-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  flex: 1;
  min-width: fit-content;
}

.test-btn {
  background: #f39c12;
}

.test-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.close-btn {
  background: #6c757d;
}

.enable-btn:hover {
  background: #2980b9;
}

.test-btn:hover:not(:disabled) {
  background: #e67e22;
}

.close-btn:hover {
  background: #5a6268;
}
</style>
