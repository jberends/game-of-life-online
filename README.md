# Game of Life Online

A multiplayer online implementation of Conway's Game of Life.

## Architecture

- **Server**: Node.js/TypeScript WebSocket server on port 8080
- **Client**: Nuxt.js frontend on port 3000
- **Communication**: Direct WebSocket connection from client to server (no proxy)

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm

### Installation
```bash
npm install
```

### Running the Application

**Option 1: Run both servers independently (recommended)**
```bash
# Terminal 1: Start the server
npm run dev:server

# Terminal 2: Start the client  
npm run dev:client
```

**Option 2: Run from workspace directories**
```bash
# Terminal 1: Start the server
cd server && npm run dev

# Terminal 2: Start the client
cd client && npm run dev
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **WebSocket**: ws://localhost:8080/ws

## Features

- Real-time multiplayer drawing
- Conway's Game of Life simulation
- WebSocket-based live updates
- HTTP fallback for drawing operations
- Responsive web interface

## Project Structure

```
├── server/          # Node.js/TypeScript backend
│   ├── src/
│   │   ├── index.ts        # WebSocket server
│   │   └── game-logic.ts   # Game of Life logic
│   └── package.json
├── client/          # Nuxt.js frontend
│   ├── composables/
│   │   └── useGameSocket.ts  # WebSocket client
│   └── package.json
└── package.json     # Root workspace config
```