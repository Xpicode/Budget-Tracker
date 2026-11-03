# Stage 1: build the React app into client/dist
FROM node:24-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: the server, serving the built app from /app/client/dist
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY server/migrations ./migrations
COPY --from=client /app/client/dist /app/client/dist
USER node
EXPOSE 4000
# Apply any new migrations, then start the API. Env vars come from docker-compose, not a file.
CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
