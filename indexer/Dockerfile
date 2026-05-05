FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --prod --ignore-scripts
CMD ["node", "dist/main.js"]
