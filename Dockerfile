# ponytail: single-stage — imagem um pouco maior, build bem mais simples
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY build.mjs server.mjs ./
COPY src ./src
COPY public ./public
RUN node build.mjs
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["node", "server.mjs"]
