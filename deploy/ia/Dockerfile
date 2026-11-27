FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY services/ia ./services/ia
COPY supabase/functions ./supabase/functions
COPY src/utils/vendedores1004.ts ./src/utils/vendedores1004.ts
RUN mkdir -p /var/lib/pelegrini-ia && chown node:node /var/lib/pelegrini-ia
USER node
CMD ["node", "services/ia/server.ts"]
