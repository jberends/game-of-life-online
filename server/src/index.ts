import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { commitCells, calculateNextStep, getFullBoardState, Cell, DeltaChange } from './game-logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Game simulation variables
let simulationInterval: NodeJS.Timeout | null = null;

// Middleware
app.use(express.json());

// In production, serve static files from the Nuxt build output
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/.output/public');
  app.use(express.static(clientBuildPath));
}

// API endpoint to get current board state
app.get('/api/board-state', (req, res) => {
  const gameState = getFullBoardState();
  res.json(gameState);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'draw') {
        const cells: Cell[] = data.cells;
        commitCells(cells);
        console.log(`Player drew ${cells.length} cells`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the game simulation
function startSimulation() {
  if (simulationInterval) return;
  
  simulationInterval = setInterval(() => {
    const { changes, nextGeneration } = calculateNextStep();
    
    if (changes.length > 0) {
      const message = JSON.stringify({
        type: 'delta',
        changes,
        generation: nextGeneration
      });
      
      // Broadcast to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(message);
        }
      });
    }
  }, 100); // Update every 100ms
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

// Start simulation
startSimulation();

// In production, serve the Nuxt app for all non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const clientBuildPath = path.join(__dirname, '../../client/.output/public');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game of Life simulation started`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  stopSimulation();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  stopSimulation();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});