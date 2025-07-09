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
      // In development, connect directly to the server port to bypass proxy issues
      // In production, use the same host as the frontend
      const isDev = window.location.port === '3000' || window.location.hostname === 'localhost';
      let wsUrl: string;
      
      if (isDev) {
        // Development: connect directly to the server on port 8080
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        wsUrl = `${protocol}//${hostname}:8080/ws`;
      } else {
        // Production: use the same host and let the server handle routing
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }
      
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
      // In development, connect directly to the server port to bypass proxy issues
      const isDev = window.location.port === '3000' || window.location.hostname === 'localhost';
      let apiUrl: string;
      
      if (isDev) {
        // Development: connect directly to the server on port 8080
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const hostname = window.location.hostname;
        apiUrl = `${protocol}//${hostname}:8080/api/board-state`;
      } else {
        // Production: use the proxy
        apiUrl = '/api/board-state';
      }
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: GameState = await response.json();
      gameState.value = data;
      generation.value = data.generation;
      console.log('Initial game state loaded:', { generation: data.generation });
    } catch (error) {
      console.error('Failed to fetch initial game state:', error);
    }
  };
  
  const sendDraw = async (cells: Cell[]) => {
    if (ws.value && connected.value) {
      // Send via WebSocket if connected
      const message = {
        type: 'draw',
        cells
      };
      ws.value.send(JSON.stringify(message));
      console.log('Draw message sent via WebSocket:', cells.length, 'cells');
    } else {
      // Fallback to HTTP if WebSocket not connected
      try {
        console.log('WebSocket not connected, using HTTP fallback');
        
        // Use the same logic as other functions for API endpoint
        const isDev = window.location.port === '3000' || window.location.hostname === 'localhost';
        let apiUrl: string;
        
        if (isDev) {
          // Development: connect directly to the server on port 8080
          const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
          const hostname = window.location.hostname;
          apiUrl = `${protocol}//${hostname}:8080/api/draw`;
        } else {
          // Production: use the proxy
          apiUrl = '/api/draw';
        }
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cells }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Draw sent via HTTP successfully');
      } catch (error) {
        console.error('Failed to send draw via HTTP:', error);
      }
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