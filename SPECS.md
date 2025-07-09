# LAN Game of Life - Technical Specifications

## Overview
A multiplayer Conway's Game of Life implementation with colored cells and real-time collaboration over WebSockets.

## Core Specifications

### Board Configuration
- **Board Size**: 25x25 cells
- **Tick Rate**: 4 generations per second (250ms intervals)
- **Max Players**: Up to 10 players can connect simultaneously

### Game Rules
- Follows standard Conway's Game of Life rules for cell survival/death
- **Color Logic**: New cells inherit colors from their neighbors using:
  1. **Dominant Color Rule**: Most frequent neighbor color wins
  2. **Tie-Breaker Rule**: RGB averaging for ties
- **Cell Survival**: Surviving cells keep their original color

### API Requirements

#### WebSocket Messages
- **Client → Server**: `{ type: 'draw', cells: Cell[] }`
- **Server → Client**: `{ type: 'delta', changes: DeltaChange[], generation: number }`

#### HTTP Endpoints
- `GET /api/board-state` - Returns current board state and generation

#### Data Types
```typescript
type Color = string; // hex format "#RRGGBB"
type Cell = { x: number; y: number; color: Color };
type DeltaChange = { x: number; y: number; color: Color | null };
type Board = (Color | null)[][];
```

#### Game Logic Interface
The game logic must expose:
- `commitCells(cells: Cell[]): void` - Apply user-drawn cells
- `calculateNextStep(): { changes: DeltaChange[]; nextGeneration: number }` - Calculate next generation
- `getFullBoardState(): { board: Board; generation: number }` - Get current state

### Implementation Details

#### Dependencies
- **Core Game Logic**: `game-life@^2.0.2` npm package
- **WebSocket**: `ws@^8.14.2`
- **Server**: `express@^4.18.2`

#### Color Inheritance Algorithm
1. For each new cell, examine all 8 neighbors
2. Count occurrences of each color
3. If one color dominates, use it
4. If tie, calculate RGB average of tied colors
5. Fallback to white (#FFFFFF) if no neighbors

#### Network Protocol
- WebSocket endpoint: `/ws`
- Auto-reconnection: Client retries every 3 seconds
- Broadcast delta changes to all connected clients
- Real-time synchronization with generation counters

### Performance Requirements
- Handle up to 10 concurrent players
- Maintain 5 FPS simulation rate
- Efficient delta-only updates
- Memory-efficient 512x512 board representation

### Development & Deployment
- **Development**: `npm run dev` (hot-reloading)
- **Production**: `npm start` (built assets)
- **Docker**: Multi-stage build with Node.js 18 Alpine
- **Ports**: Server on 8080, Client on 3000