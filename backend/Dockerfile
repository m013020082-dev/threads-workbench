FROM node:20-slim

# Install system dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y \
  libglib2.0-0 \
  libnss3 \
  libnspr4 \
  libdbus-1-3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  libexpat1 \
  libx11-6 \
  libxcb1 \
  libxext6 \
  fonts-noto-cjk \
  wget \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (including playwright)
COPY package*.json ./
RUN npm ci --omit=dev

# Install Playwright browser to a fixed known location
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Copy source files (node_modules is NOT in upload due to .gitignore)
COPY . .

CMD ["node", "dist/index.js"]
