# Guia de Deploy na VPS (Ubuntu)

Este guia ensina como fazer o deploy da aplicação ZapFlow (construída em Vite + React + TanStack Router) em uma VPS rodando Ubuntu.

Como o projeto é um SPA (Single Page Application) e utiliza o Supabase para backend, não precisamos manter um servidor Node.js (PM2) rodando de forma contínua para a aplicação principal. Precisamos apenas construir os arquivos estáticos e servi-los com o **Nginx**.

---

## 1. Preparação da VPS

Acesse a sua VPS usando SSH:
```bash
ssh root@IP_DA_SUA_VPS
```

Atualize os pacotes do sistema:
```bash
sudo apt update && sudo apt upgrade -y
```

### Instalar Node.js e NPM (para fazer o build, se for fazer na própria VPS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Instalar o Nginx (Servidor Web)
```bash
sudo apt install -y nginx
```

---

## 2. Passando os Arquivos para a VPS

Você tem duas opções para gerar a "build" do seu sistema:

### Opção A: Fazer o build no seu computador local e enviar para a VPS
1. No seu computador, abra o terminal na pasta do projeto e rode:
   ```bash
   npm run build
   ```
2. Uma pasta `dist` será gerada.
3. Envie o conteúdo dessa pasta para a VPS (você pode usar um programa como FileZilla, WinSCP ou comando `scp`).
4. Coloque os arquivos no diretório: `/var/www/zapflow` da VPS.

### Opção B: Clonar o repositório e fazer o build direto na VPS
1. Na VPS, clone o seu repositório:
   ```bash
   git clone URL_DO_SEU_REPOSITORIO /var/www/zapflow
   ```
2. Entre na pasta:
   ```bash
   cd /var/www/zapflow
   ```
3. Instale as dependências e rode o build:
   ```bash
   npm install
   npm run build
   ```
4. Os arquivos estáticos estarão na pasta `/var/www/zapflow/dist`.

---

## 3. Configurando o Nginx

Para o TanStack Router (e qualquer aplicação React SPA) funcionar corretamente, sempre que o usuário acessar uma URL diretamente (ex: `seu-dominio.com/login`), o Nginx precisa redirecioná-lo para o arquivo `index.html`. 

1. Crie o arquivo de configuração do Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/zapflow
   ```

2. Cole o código abaixo (lembre-se de mudar `seu-dominio.com` e o caminho `root` caso tenha usado a Opção A ou B):

   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com www.seu-dominio.com; # Substitua pelo seu domínio ou IP

       # Se você enviou os arquivos do /dist direto: root /var/www/zapflow;
       # Se você rodou o build na VPS: root /var/www/zapflow/dist;
       root /var/www/zapflow/dist; 
       
       index index.html;

       location / {
           # Tenta carregar o arquivo, se não achar, manda pro index.html (Essencial pro React Router)
           try_files $uri $uri/ /index.html;
       }

       # Opcional: Cache de arquivos estáticos (CSS, JS, Imagens) para deixar mais rápido
       location ~* \.(?:css|js|jpg|svg|png|woff2?)$ {
           expires 1y;
           access_log off;
           add_header Cache-Control "public";
       }
   }
   ```
   *Para salvar no nano, aperte `CTRL + O`, depois `ENTER`, e `CTRL + X` para sair.*

3. Ative o site criando um atalho na pasta `sites-enabled`:
   ```bash
   sudo ln -s /etc/nginx/sites-available/zapflow /etc/nginx/sites-enabled/
   ```

4. Verifique se a sintaxe do Nginx está correta e sem erros:
   ```bash
   sudo nginx -t
   ```

5. Reinicie o Nginx para aplicar as configurações:
   ```bash
   sudo systemctl restart nginx
   ```

---

## 4. Configurar Certificado SSL/HTTPS (Grátis com Certbot)

Para não ficar com o aviso de "Não Seguro" e garantir a privacidade, instale o SSL gratuito.

1. Instale o Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. Gere o certificado (o Nginx será configurado automaticamente):
   ```bash
   sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
   ```
   *Responda as perguntas (email, termos) e o HTTPS será ativado.*

---

## Alternativa: Deploy usando Docker e Docker Compose

Se você prefere empacotar toda a aplicação em um container Docker, eu já criei os arquivos necessários (`Dockerfile`, `docker-compose.yml`, `nginx.conf` e `.dockerignore`). 

Para rodar via Docker na VPS:

1. Acesse a VPS e instale o Docker e o Docker Compose.
   ```bash
   # Instalação rápida do Docker
   curl -fsSL https://get.docker.com | sh
   ```
2. Mande o código do projeto para a VPS ou clone o repositório em uma pasta (ex: `/var/www/zapflow`).
3. Entre na pasta:
   ```bash
   cd /var/www/zapflow
   ```
4. Suba os containers (o Docker irá baixar a imagem do Node, compilar o Vite, e subir o Nginx automaticamente):
   ```bash
   docker compose up -d --build
   ```
5. Pronto! Sua aplicação estará rodando na porta 80 da VPS. Caso você já use outro proxy reverso na VPS (Nginx Principal, Traefik, NPM), basta mudar o mapeamento de portas no arquivo `docker-compose.yml` (ex: de `"80:80"` para `"8080:80"`).

---

## Pronto! 🚀
Agora é só acessar o seu domínio (ou IP da VPS) e o ZapFlow estará funcionando com o deploy em produção. Sempre que for fazer atualizações futuras, caso use a forma tradicional, basta gerar um novo `npm run build`; e se usar o Docker, basta rodar `docker compose up -d --build`.
