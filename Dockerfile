# Stage 1: Build the Nuxt client
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY client/package.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Build the Node.js server
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY server/package.json ./server/
COPY server/tsconfig.json ./server/
RUN cd server && npm install
COPY server/ ./server/
RUN cd server && npm run build

# Stage 3: Final production image
FROM node:20-alpine
WORKDIR /app

# Copy server build output and dependencies
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/

# Copy client build output
COPY --from=client-builder /app/client/.output ./client/.output

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# The command to run the application
CMD ["node", "server/dist/index.js"]