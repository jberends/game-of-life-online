import { ref, readonly, onMounted, onUnmounted } from 'vue';

interface Cell {
  x: number;
  y: number;
  color: string;
}

interface DeltaChange {
  x: number;
  y: number;
  color: string | null;
}

interface GameState {
  board: (string | null)[][];
  generation: number;
}

interface WebSocketMessage {
  type: string;
  changes?: DeltaChange[];
  generation?: number;
}

export const useGameSocket = () => {
  const gameState = ref<GameState | null>(null);
  const generation = ref(0);
  const ws = ref<WebSocket | null>(null);
  const connected = ref(false);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;
  
  const connect = () => {
    try {
      // Use the proxy endpoint instead of trying to connect directly to the server
      // The Nuxt dev server will proxy /ws to the actual WebSocket server on port 8080
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Attempting to connect to WebSocket:', wsUrl);
      ws.value = new WebSocket(wsUrl);
      
      ws.value.onopen = () => {
        console.log('WebSocket connected successfully');
        connected.value = true;
        reconnectAttempts.value = 0;
        
        // Fetch initial game state via HTTP API (also proxied)
        fetchInitialState();
      };
      
      ws.value.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'delta' && message.changes && message.generation) {
            // Apply delta changes to the current board
            if (gameState.value) {
              for (const change of message.changes) {
                if (change.y >= 0 && change.y < gameState.value.board.length &&
                    change.x >= 0 && change.x < gameState.value.board[change.y].length) {
                  gameState.value.board[change.y][change.x] = change.color;
                }
              }
              generation.value = message.generation;
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.value.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        connected.value = false;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.value < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.value + 1}/${maxReconnectAttempts})`);
          
          setTimeout(() => {
            if (!connected.value) {
              reconnectAttempts.value++;
              connect();
            }
          }, delay);
        } else {
          console.error('Max reconnection attempts reached. Please refresh the page.');
        }
      };
      
      ws.value.onerror = (error) => {
        console.error('WebSocket error:', error);
        connected.value = false;
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };
  
  const fetchInitialState = async () => {
    try {
      console.log('Fetching initial board state...');
      const response = await fetch('/api/board-state');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      gameState.value = data;
      generation.value = data.generation;
      console.log('Initial board state loaded successfully');
    } catch (error) {
      console.error('Error fetching initial state:', error);
      // Retry after a delay
      setTimeout(fetchInitialState, 2000);
    }
  };
  
  const sendDraw = (cells: Cell[]) => {
    if (ws.value && connected.value && ws.value.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: 'draw',
          cells
        };
        ws.value.send(JSON.stringify(message));
        console.log(`Sent draw message with ${cells.length} cells`);
      } catch (error) {
        console.error('Error sending draw message:', error);
      }
    } else {
      console.warn('Cannot send draw message: WebSocket not connected');
    }
  };
  
  const disconnect = () => {
    if (ws.value) {
      ws.value.close(1000, 'User disconnected');
      ws.value = null;
    }
    connected.value = false;
    reconnectAttempts.value = 0;
  };
  
  // Auto-connect on mount
  onMounted(() => {
    connect();
  });
  
  // Auto-disconnect on unmount
  onUnmounted(() => {
    disconnect();
  });
  
  return {
    gameState: readonly(gameState),
    generation: readonly(generation),
    connected: readonly(connected),
    reconnectAttempts: readonly(reconnectAttempts),
    sendDraw,
    disconnect,
    connect
  };
};