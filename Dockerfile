# Estágio 1: Build da Aplicação
FROM node:20-alpine as build
WORKDIR /app

# Instala as dependências
COPY package*.json ./
RUN npm install

# Copia o restante do código e gera o build de produção
COPY . .
RUN npm run build

# Estágio 2: Servidor Web (Nginx)
FROM nginx:alpine

# Copia os arquivos gerados no build para a pasta pública do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia a configuração customizada do Nginx (para SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
