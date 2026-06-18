# Deployment

## Runtime

The app is split into:

- `server/`: Express API, SQLite database, static file serving in production.
- `client/`: Vite React app built into `client/dist`.

## Environment

Copy `.env.example` to `.env` and set:

```text
JWT_SECRET=<strong-random-secret>
DATABASE_PATH=./server/data/final-killer.db
PORT=4000
CLIENT_ORIGIN=https://your-domain.example
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<independent-strong-password>
```

`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 同时设置后，服务启动时会创建该管理员；如果用户名已经存在，则会将该账号提升为管理员并同步环境变量中的密码。不要复用普通用户密码，也不要把真实密码提交到仓库。

## Build

```bash
npm install
npm run seed
npm run build
npm start
```

The server serves the built frontend from `client/dist` when it exists.

## Nginx Reverse Proxy

```nginx
server {
  listen 80;
  server_name your-domain.example;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## SQLite Backup

Stop the service or ensure no writes are in progress, then copy:

```text
server/data/final-killer.db
```

Keep backups together with the matching `data/questions.json` used to seed the app.

## Question Bank

The initial question bank lives at `data/questions.json`. Run `npm run seed` to create tables and import it into SQLite.

After the first deployment, use the administrator page at `/admin/question-bank` for routine updates. Upload the JSON file, review the validated diff, then confirm the import. The server stores previews and version snapshots in SQLite, so the database file must be included in normal backups. Do not use `npm run seed` for routine production updates because seed clears learning progress.
