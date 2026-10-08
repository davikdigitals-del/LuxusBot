FROM node:18-alpine

# Chromium is only needed by the legacy single-tenant WhatsApp client
# (ENABLE_LEGACY_WHATSAPP=true). The multi-tenant SaaS path does not use it;
# leaving it out keeps the default image small. Re-add this apk step if you
# turn the legacy client on.
# RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
#     PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p logs knowledge whatsapp-session

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/index.js"]
