FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements*.txt ./
RUN python3 -m venv .venv \
    && .venv/bin/python -m pip install --no-cache-dir -r requirements-torch.txt \
    && .venv/bin/python -m pip install --no-cache-dir -r requirements.txt
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p data models && chown -R node:node /app
USER node
ENV HOST=0.0.0.0
EXPOSE 3220
CMD ["node", "server.js"]
