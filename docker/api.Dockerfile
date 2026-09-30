FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build -w @sami/shared && npm run build -w @sami/api
CMD ["sh","-c","npx prisma migrate deploy && node apps/api/dist/main.js"]
