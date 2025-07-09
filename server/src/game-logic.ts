import { GameEngine, GameBoard } from 'game-life';

// --- Type Definitions ---
export type Color = string; // e.g., "#RRGGBB"
export type Board = (Color | null)[][];
export type Cell = { x: number; y: number; color: Color };
export type DeltaChange = { x: number; y: number; color: Color | null };

const BOARD_WIDTH = 512;
const BOARD_HEIGHT = 512;

// --- Core State ---
let board: Board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
let generation = 0;

/**
 * Applies a set of user-drawn cells to the main board.
 */
export function commitCells(cells: Cell[]): void {
  for (const cell of cells) {
    if (cell.x >= 0 && cell.x < BOARD_WIDTH && cell.y >= 0 && cell.y < BOARD_HEIGHT) {
      board[cell.y][cell.x] = cell.color;
    }
  }
}

/**
 * Calculates the next state of the game and returns the changes.
 */
export function calculateNextStep(): { changes: DeltaChange[]; nextGeneration: number } {
  generation++;

  // --- Step 1: Structural Calculation using 'game-life' library ---
  const gameBoard = new GameBoard();
  const gameEngine = new GameEngine();
  const previousStateMatrix: (0 | 1)[][] = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));

  // Populate the library's instance and our previous state matrix
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (board[y][x]) {
        gameBoard.setCell(x, y, true);
        previousStateMatrix[y][x] = 1;
      }
    }
  }

  // Calculate the next structural state
  const nextGameBoard = gameEngine.nextGeneration(gameBoard);

  // --- Step 2: Build the new board and identify changes ---
  const newBoard: Board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
  const changes: DeltaChange[] = [];

  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const isAliveInNewState = nextGameBoard.getCell(x, y) === true;
      const wasAliveInOldState = previousStateMatrix[y][x] === 1;

      if (isAliveInNewState) {
        if (wasAliveInOldState) {
          // Cell survives: it keeps its old color
          newBoard[y][x] = board[y][x];
        } else {
          // Cell is born: apply our custom color logic
          newBoard[y][x] = getNewCellColor(x, y);
        }
      } else {
        // Cell is dead
        newBoard[y][x] = null;
      }

      // If the state differs from the old board, record the change
      if (newBoard[y][x] !== board[y][x]) {
        changes.push({ x, y, color: newBoard[y][x] });
      }
    }
  }

  // Update the main board state
  board = newBoard;

  return { changes, nextGeneration: generation };
}

/**
 * Determines the color of a newly born cell based on its parents.
 */
function getNewCellColor(x: number, y: number): Color {
  const neighbors = getLiveNeighbors(x, y);
  const neighborColors = neighbors.map(n => n.color);

  // Dominant Color Rule
  const colorCounts = new Map<Color, number>();
  for (const color of neighborColors) {
    colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
  }

  let dominantColor: Color | null = null;
  let maxCount = 0;
  let isTie = false;

  for (const [color, count] of colorCounts.entries()) {
    if (count > maxCount) {
      dominantColor = color;
      maxCount = count;
      isTie = false;
    } else if (count === maxCount) {
      isTie = true;
    }
  }

  // Tie-Breaker Rule: Fallback to average
  if (isTie || !dominantColor) {
    return averageColors(neighborColors);
  }

  return dominantColor;
}

/**
 * Finds the live neighbors and their colors for a given cell.
 */
function getLiveNeighbors(x: number, y: number): { color: Color }[] {
  const neighbors: { color: Color }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < BOARD_WIDTH && ny >= 0 && ny < BOARD_HEIGHT && board[ny][nx]) {
        neighbors.push({ color: board[ny][nx]! });
      }
    }
  }
  return neighbors;
}

/**
 * Averages an array of hex colors.
 */
function averageColors(colors: Color[]): Color {
  if (colors.length === 0) return '#FFFFFF'; // Should not happen

  let totalR = 0, totalG = 0, totalB = 0;
  for (const hex of colors) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    totalR += r;
    totalG += g;
    totalB += b;
  }

  const avgR = Math.round(totalR / colors.length);
  const avgG = Math.round(totalG / colors.length);
  const avgB = Math.round(totalB / colors.length);

  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
}

/**
 * Gets the full board state for new players.
 */
export function getFullBoardState(): { board: Board; generation: number } {
  return { board, generation };
}