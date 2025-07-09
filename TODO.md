# Project TODO & Setup Guide

You have successfully generated the LAN Game of Life application. Here are the next steps to get it running.

## 1. Initialize Git Repository

It's highly recommended to initialize a git repository to track your changes.

```bash
git init
git add .
git commit -m "Initial commit of generated Game of Life app"
```

## 2. Install Dependencies

Install all dependencies for both the `server` and `client` using the root `package.json` script.

```bash
npm install
```

## 3. Run in Development Mode

To start the application in development mode, run the following command from the **root directory**. This will start both the backend server and the Nuxt frontend server with hot-reloading.

- Nuxt UI will be available at `http://localhost:3000`
- Node.js Backend will be running on port `8080`

```bash
npm run dev
```

## 4. Build and Run for Production

To simulate a production environment or to host a game for others on your LAN:

```bash
# This command first builds the Nuxt app, then starts the main server.
npm start
```

The game will be accessible to anyone on your local network at `http://<your-ip-address>:3000`.

## 5. Build and Run with Docker

To build and run the application using the provided Dockerfile:

```bash
# Build the docker image
docker build -t lan-game-of-life .

# Run the container, mapping port 3000
docker run -p 3000:3000 lan-game-of-life
```

The game will then be accessible at `http://localhost:3000`.

## How to Play

1. **Connect**: Open your web browser and navigate to the game URL
2. **Draw**: Click on cells in the game board to add them to your staging area (shown with transparency)
3. **Commit**: Click the "Commit to Board" button to make your cells live
4. **Watch**: Observe as your patterns evolve according to Conway's Game of Life rules
5. **Interact**: Your patterns will interact with other players' patterns, creating new colored cells based on neighboring colors

## Technical Details

- **Board Size**: 512x512 cells
- **Tick Rate**: 5 ticks per second (200ms intervals)
- **Max Players**: Up to 10 players can connect simultaneously
- **Color Logic**: New cells inherit colors from their neighbors using a dominant color rule with RGB averaging for ties
- **Real-time Updates**: Uses WebSockets for low-latency communication

## Troubleshooting

- If the WebSocket connection fails, the client will automatically attempt to reconnect every 3 seconds
- Make sure both the server (port 8080) and client (port 3000) ports are available
- For LAN access, ensure your firewall allows connections on the specified ports