FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=15173
ENV K_DATA_API_BASE_URL=http://127.0.0.1:28080
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 15173
CMD ["node", "server/serve.mjs"]
