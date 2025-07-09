<template>
  <div class="game-board-container">
    <div class="controls mb-4">
      <UButton 
        :disabled="stagingCells.length === 0" 
        @click="commitCells"
        color="primary"
        size="lg"
      >
        Commit to Board ({{ stagingCells.length }} cells)
      </UButton>
      <UButton 
        :disabled="stagingCells.length === 0" 
        @click="clearStaging"
        color="gray"
        size="lg"
        class="ml-2"
      >
        Clear Staging
      </UButton>
    </div>
    
    <div class="board-info mb-2">
      <p class="text-sm text-gray-600">
        Generation: {{ generation }} | Your color: 
        <span class="inline-block w-4 h-4 ml-1 border border-gray-300" :style="{ backgroundColor: playerColor }"></span>
        <UButton 
          @click="regenerateColor" 
          size="xs" 
          color="gray" 
          variant="ghost"
          class="ml-2"
        >
          Change Color
        </UButton>
      </p>
      <p class="text-xs text-gray-500">
        Client ID: {{ clientId }}
      </p>
    </div>
    
    <div class="canvas-container">
      <canvas
        ref="canvasRef"
        :width="CANVAS_SIZE"
        :height="CANVAS_SIZE"
        class="border border-gray-300 cursor-crosshair"
        @click="handleCanvasClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
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

const { gameState, sendDraw, generation } = useGameSocket();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const stagingCells = ref<Cell[]>([]);
const playerColor = ref('');
const clientId = ref('');

const BOARD_SIZE = 25;
const CANVAS_SIZE = 500; // Keep canvas visually large but with 25x25 cells
const CELL_SIZE = CANVAS_SIZE / BOARD_SIZE;

// Generate a unique client ID that persists for this browser tab
const generateClientId = (): string => {
  // Check if we already have a client ID in sessionStorage (unique per tab)
  let id = sessionStorage.getItem('gameOfLife_clientId');
  if (!id) {
    // Generate a new unique ID using timestamp and random number
    id = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('gameOfLife_clientId', id);
  }
  return id;
};

// Generate a random, visually pleasing color for the player
const generatePlayerColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Get or generate player color with localStorage persistence
const getPlayerColor = (): string => {
  // Try to get color from localStorage (persists across all tabs and sessions)
  const savedColor = localStorage.getItem('gameOfLife_playerColor');
  if (savedColor) {
    console.log('Loaded saved player color:', savedColor);
    return savedColor;
  }
  
  // Generate new color and save it
  const newColor = generatePlayerColor();
  localStorage.setItem('gameOfLife_playerColor', newColor);
  console.log('Generated new player color:', newColor);
  return newColor;
};

onMounted(() => {
  clientId.value = generateClientId();
  playerColor.value = getPlayerColor();
  console.log('Client initialized:', { clientId: clientId.value, playerColor: playerColor.value });
  drawBoard();
});

const drawBoard = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Clear canvas
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  
  // Draw committed cells from server
  if (gameState.value?.board) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = gameState.value.board[y][x];
        if (cell) {
          ctx.fillStyle = cell;
          ctx.fillRect(
            x * CELL_SIZE,
            y * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE
          );
        }
      }
    }
  }
  
  // Draw staging cells with transparency
  ctx.globalAlpha = 0.5;
  for (const cell of stagingCells.value) {
    ctx.fillStyle = cell.color;
    ctx.fillRect(
      cell.x * CELL_SIZE,
      cell.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE
    );
  }
  ctx.globalAlpha = 1.0;
};

const handleCanvasClick = (event: MouseEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / CELL_SIZE);
  const y = Math.floor((event.clientY - rect.top) / CELL_SIZE);
  
  if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
    // Check if cell is already in staging
    const existingIndex = stagingCells.value.findIndex(cell => cell.x === x && cell.y === y);
    
    if (existingIndex >= 0) {
      // Remove from staging if already there
      stagingCells.value.splice(existingIndex, 1);
    } else {
      // Add to staging
      stagingCells.value.push({ x, y, color: playerColor.value });
    }
    
    drawBoard();
  }
};

const commitCells = () => {
  if (stagingCells.value.length > 0) {
    sendDraw(stagingCells.value, clientId.value);
    stagingCells.value = [];
    drawBoard();
  }
};

const clearStaging = () => {
  stagingCells.value = [];
  drawBoard();
};

const regenerateColor = () => {
  playerColor.value = generatePlayerColor();
  localStorage.setItem('gameOfLife_playerColor', playerColor.value);
  console.log('Player color regenerated:', playerColor.value);
  drawBoard();
};

// Watch for board updates from server
watch(gameState, () => {
  drawBoard();
}, { deep: true });

// Watch for generation updates
watch(generation, () => {
  drawBoard();
});
</script>

<style scoped>
.game-board-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.canvas-container {
  position: relative;
}

canvas {
  display: block;
}
</style>