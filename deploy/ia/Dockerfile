FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY services/ia ./services/ia
COPY supabase/functions ./supabase/functions
USER node
CMD ["node", "services/ia/server.ts"]
