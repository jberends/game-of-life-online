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
  cells?: Cell[];
  clientId?: string;
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
      // Always connect directly to the server on port 8080
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname;
      const wsUrl = `${protocol}//${hostname}:8080/ws`;
      
      console.log('Attempting to connect to WebSocket:', wsUrl);
      ws.value = new WebSocket(wsUrl);
      
      ws.value.onopen = () => {
        console.log('WebSocket connected successfully');
        connected.value = true;
        reconnectAttempts.value = 0;
        
        // Fetch initial game state via HTTP API
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
          } else if (message.type === 'immediate_draw' && message.cells) {
            // Apply drawn cells immediately to the board
            if (gameState.value) {
              for (const cell of message.cells) {
                if (cell.y >= 0 && cell.y < gameState.value.board.length &&
                    cell.x >= 0 && cell.x < gameState.value.board[cell.y].length) {
                  gameState.value.board[cell.y][cell.x] = cell.color;
                }
              }
              console.log('Applied immediate draw:', message.cells.length, 'cells from client:', message.clientId || 'unknown');
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
      // Always connect directly to the server on port 8080
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = window.location.hostname;
      const apiUrl = `${protocol}//${hostname}:8080/api/board-state`;
      
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
  
  const sendDraw = async (cells: Cell[], clientId?: string) => {
    if (ws.value && connected.value) {
      // Send via WebSocket if connected
      const message = {
        type: 'draw',
        cells,
        clientId: clientId || 'unknown'
      };
      ws.value.send(JSON.stringify(message));
      console.log('Draw message sent via WebSocket:', cells.length, 'cells', 'from client:', clientId);
    } else {
      // Fallback to HTTP if WebSocket not connected
      try {
        console.log('WebSocket not connected, using HTTP fallback');
        
        // Always connect directly to the server on port 8080
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const hostname = window.location.hostname;
        const apiUrl = `${protocol}//${hostname}:8080/api/draw`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cells, clientId: clientId || 'unknown' }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Draw sent via HTTP successfully from client:', clientId);
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