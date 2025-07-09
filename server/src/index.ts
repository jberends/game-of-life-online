import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { commitCells, calculateNextStep, getFullBoardState, Cell, DeltaChange } from './game-logic.js';

// Extend WebSocket interface to include isAlive property
interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server with better configuration
const wss = new WebSocketServer({ 
  server, 
  path: '/ws',
  perMessageDeflate: false, // Disable compression to reduce overhead
  maxPayload: 1024 * 1024, // 1MB max payload
});

// Game simulation variables
let simulationInterval: NodeJS.Timeout | null = null;

// Track active connections
const activeConnections = new Set<ExtendedWebSocket>();

// Middleware
app.use(express.json());

// CORS middleware to allow requests from the client
app.use((req, res, next) => {
  // Allow requests from the client development server
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.145.189:3000',
    // Add more origins as needed for different network configurations
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin as string)) {
    res.setHeader('Access-Control-Allow-Origin', origin as string);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// In production, serve static files from the Nuxt build output
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/.output/public');
  app.use(express.static(clientBuildPath));
}

// API endpoint to get current board state
app.get('/api/board-state', (req, res) => {
  try {
    const gameState = getFullBoardState();
    res.json(gameState);
  } catch (error) {
    console.error('Error getting board state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to draw cells (HTTP fallback)
app.post('/api/draw', (req, res) => {
  try {
    const { cells, clientId } = req.body;
    if (!Array.isArray(cells)) {
      return res.status(400).json({ error: 'Invalid cells data' });
    }
    
    const client = clientId || 'unknown';
    commitCells(cells);
    console.log(`Client ${client} drew ${cells.length} cells via HTTP`);
    
    // Immediately broadcast the drawn cells to all clients
    const drawMessage = JSON.stringify({
      type: 'immediate_draw',
      cells: cells,
      clientId: client
    });
    
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === client.OPEN) {
        try {
          client.send(drawMessage);
        } catch (error) {
          console.error('Error sending immediate draw message:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
    });
    
    res.json({ success: true, cellsDrawn: cells.length });
  } catch (error) {
    console.error('Error processing draw request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket connection handling with improved error management
wss.on('connection', (ws: ExtendedWebSocket, req) => {
  console.log('New client connected from', req.socket.remoteAddress);
  activeConnections.add(ws);
  
  // Set up ping/pong for connection health monitoring
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'draw') {
        const cells: Cell[] = data.cells;
        const clientId = data.clientId || 'unknown';
        commitCells(cells);
        console.log(`Client ${clientId} drew ${cells.length} cells`);
        
        // Immediately broadcast the drawn cells to all clients
        const drawMessage = JSON.stringify({
          type: 'immediate_draw',
          cells: cells,
          clientId: clientId
        });
        
        wss.clients.forEach((client: ExtendedWebSocket) => {
          if (client.readyState === client.OPEN) {
            try {
              client.send(drawMessage);
            } catch (error) {
              console.error('Error sending immediate draw message:', error instanceof Error ? error.message : 'Unknown error');
            }
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      // Don't close connection for parsing errors, just log them
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Client disconnected: ${code} ${reason}`);
    activeConnections.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    activeConnections.delete(ws);
    // Don't rethrow the error to prevent unhandled rejection
  });
});

// Heartbeat to detect broken connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws: ExtendedWebSocket) => {
    if (ws.isAlive === false) {
      console.log('Terminating inactive connection');
      activeConnections.delete(ws);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Check every 30 seconds

// Start the game simulation
function startSimulation() {
  if (simulationInterval) return;
  
  simulationInterval = setInterval(() => {
    try {
      const { changes, nextGeneration } = calculateNextStep();
      
      if (changes.length > 0) {
        const message = JSON.stringify({
          type: 'delta',
          changes,
          generation: nextGeneration
        });
        
        // Broadcast to all connected clients with error handling
        const clientsToRemove: ExtendedWebSocket[] = [];
        wss.clients.forEach((client: ExtendedWebSocket) => {
          if (client.readyState === client.OPEN) {
            try {
              client.send(message);
            } catch (error) {
              console.error('Error sending message to client:', error instanceof Error ? error.message : 'Unknown error');
              clientsToRemove.push(client);
            }
          } else {
            clientsToRemove.push(client);
          }
        });
        
        // Clean up failed connections
        clientsToRemove.forEach(client => {
          activeConnections.delete(client);
        });
      }
    } catch (error) {
      console.error('Error in simulation step:', error);
    }
  }, 100); // Update every 100ms
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (heartbeat) {
    clearInterval(heartbeat);
  }
}

// Add global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process immediately, try to clean up
  stopSimulation();
  setTimeout(() => process.exit(1), 1000);
});

// Start simulation
startSimulation();

// In production, serve the Nuxt app for all non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const clientBuildPath = path.join(__dirname, '../../client/.output/public');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start server with error handling
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game of Life simulation started`);
  console.log(`Active connections will be monitored every 30 seconds`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
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