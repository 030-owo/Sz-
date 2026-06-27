# 多階段：安裝→建置(後端+前端)→精簡執行映像
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
COPY packages/agent/package.json packages/agent/package.json
# 安裝（含 dev 依賴以利建置）
RUN npm install
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/web packages/web
RUN npm run build -w packages/shared \
 && npm run build -w packages/server \
 && npm run build -w packages/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/migrations ./packages/server/migrations
# 前端靜態檔，server 啟動時自動偵測並提供
COPY --from=build /app/packages/web/dist ./packages/web/dist
EXPOSE 8080
CMD ["node", "packages/server/dist/index.js"]
