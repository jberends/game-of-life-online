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
  
  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.value = new WebSocket(wsUrl);
    
    ws.value.onopen = () => {
      console.log('WebSocket connected');
      connected.value = true;
      
      // Fetch initial game state
      fetchInitialState();
    };
    
    ws.value.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'delta' && message.changes && message.generation) {
          // Apply delta changes to the current board
          if (gameState.value) {
            for (const change of message.changes) {
              gameState.value.board[change.y][change.x] = change.color;
            }
            generation.value = message.generation;
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.value.onclose = () => {
      console.log('WebSocket disconnected');
      connected.value = false;
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!connected.value) {
          connect();
        }
      }, 3000);
    };
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };
  
  const fetchInitialState = async () => {
    try {
      const response = await fetch('/api/board-state');
      const data = await response.json();
      gameState.value = data;
      generation.value = data.generation;
    } catch (error) {
      console.error('Error fetching initial state:', error);
    }
  };
  
  const sendDraw = (cells: Cell[]) => {
    if (ws.value && connected.value) {
      const message = {
        type: 'draw',
        cells
      };
      ws.value.send(JSON.stringify(message));
    }
  };
  
  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    connected.value = false;
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
    sendDraw,
    disconnect,
    connect
  };
};