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
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseLeave"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
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
const isDrawing = ref(false);
const lastDrawnCell = ref<{x: number, y: number} | null>(null);
const needsRedraw = ref(true);
const animationFrameId = ref<number | null>(null);

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

  // Watch for game state changes and redraw
  watch(gameState, () => {
    if (gameState.value) {
      needsRedraw.value = true;
      drawBoard();
    }
  }, { deep: true });

  // Initial draw when component mounts
  onMounted(() => {
    clientId.value = generateClientId();
    playerColor.value = getPlayerColor();
    console.log('Client initialized:', { clientId: clientId.value, playerColor: playerColor.value });
    needsRedraw.value = true;
    drawBoard();
  });

  // Cleanup on unmount
  onUnmounted(() => {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value);
    }
  });

const drawBoard = () => {
  if (!needsRedraw.value) return;
  
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value);
  }
  
  animationFrameId.value = requestAnimationFrame(() => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw the game board
    if (gameState.value?.board) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const color = gameState.value.board[y][x];
          if (color && color !== '#999999') { // Don't draw neutral grey cells
            ctx.fillStyle = color;
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // Draw staging cells with transparency
    ctx.globalAlpha = 0.7;
    for (const cell of stagingCells.value) {
      ctx.fillStyle = cell.color;
      ctx.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    ctx.globalAlpha = 1.0;

    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }
    
    needsRedraw.value = false;
    animationFrameId.value = null;
  });
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

const handleMouseDown = (event: MouseEvent) => {
  isDrawing.value = true;
  handleMouseMove(event); // Draw the initial cell
};

const handleMouseMove = (event: MouseEvent) => {
  if (!isDrawing.value) return;
  
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / CELL_SIZE);
  const y = Math.floor((event.clientY - rect.top) / CELL_SIZE);

  // Check if we're within bounds and haven't already drawn this cell
  if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
    // Avoid drawing the same cell multiple times during drag
    if (lastDrawnCell.value && lastDrawnCell.value.x === x && lastDrawnCell.value.y === y) {
      return;
    }
    
    lastDrawnCell.value = { x, y };
    
    // Check if this cell is already in staging
    const existingIndex = stagingCells.value.findIndex(cell => cell.x === x && cell.y === y);
    if (existingIndex === -1) {
      stagingCells.value.push({ x, y, color: playerColor.value });
      needsRedraw.value = true;
      drawBoard();
    }
  }
};

const handleMouseUp = () => {
  isDrawing.value = false;
  lastDrawnCell.value = null;
};

const handleMouseLeave = () => {
  isDrawing.value = false;
  lastDrawnCell.value = null;
};

const handleTouchStart = (event: TouchEvent) => {
  event.preventDefault();
  isDrawing.value = true;
  const touch = event.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  handleMouseMove(mouseEvent);
};

const handleTouchMove = (event: TouchEvent) => {
  event.preventDefault();
  if (!isDrawing.value) return;
  
  const touch = event.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  handleMouseMove(mouseEvent);
};

const handleTouchEnd = (event: TouchEvent) => {
  event.preventDefault();
  isDrawing.value = false;
  lastDrawnCell.value = null;
};

const commitCells = () => {
  if (stagingCells.value.length > 0) {
    sendDraw(stagingCells.value, clientId.value);
    stagingCells.value = [];
    needsRedraw.value = true;
    drawBoard();
  }
};

const clearStaging = () => {
  stagingCells.value = [];
  needsRedraw.value = true;
  drawBoard();
};

const regenerateColor = () => {
  playerColor.value = generatePlayerColor();
  localStorage.setItem('gameOfLife_playerColor', playerColor.value);
  console.log('Player color regenerated:', playerColor.value);
  drawBoard();
};

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