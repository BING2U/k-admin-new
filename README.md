# k-admin-new

Vue 3 + TypeScript 管理台（基于 [vue-pure-admin 精简版](https://github.com/pure-admin/pure-admin-thin)）。只通过 HTTP 调用 **k-data-new**，不直连数据库、不包含抓取逻辑。

v0.1 页面：登录、数据源（只读）、艺人列表/搜索、艺人详情（改名/合并）、入库失败。

OpenAPI **v0.2** 展示（艺人详情，空字段显示为 —，不编造）：

- 出道日期 `debut_date`；有则显示 `debut_kind`、`nationality`
- 团体显示 `member_count`
- 成员关系保留 `member_name` 方向（团体看成员名）；有则显示 `is_leader`、`joined_at`、`left_at`、`role`
- 专辑列表 `GET /v1/artists/{id}/albums`；展开读取 `GET /v1/albums/{id}/tracks`（曲名、曲序、时长）
- 仍只用名称首字母，不展示人脸照片；Melon 不是本页依赖

## 准备

- Node.js 20.19+ 或 22.13+
- 已启动的 k-data-new HTTP API（默认 `http://127.0.0.1:28080`）

```bash
cp .env.example .env.local
# 编辑 .env.local：设置 ADMIN_PASSWORD，必要时改 K_DATA_API_BASE_URL
```

`.env.local` 已被 gitignore。不要提交真实密码或 `.env` 密钥。

| 变量                  | 默认                     | 说明                                                    |
| --------------------- | ------------------------ | ------------------------------------------------------- |
| `ADMIN_USERNAME`      | `admin`                  | 唯一本地账号                                            |
| `ADMIN_PASSWORD`      | （必填）                 | 运行时 scrypt 哈希后校验，无 GitHub OAuth               |
| `K_DATA_API_BASE_URL` | `http://127.0.0.1:28080` | Vite / Docker 把同源 `/v1` 代理到该地址                 |
| `VITE_PORT`           | `15173`                  | 管理台端口（避开 5173 / 8080 / 18080）                  |
| `VITE_API_BASE_URL`   | 空                       | 可选。填写后浏览器直连 API（需 CORS）；留空则走同源代理 |

## 本地开发

pnpm：

```bash
pnpm install
pnpm dev
```

npm：

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:15173`，使用 `.env.local` 中的用户名/密码登录。

开发时前端请求 `/v1/...`，由 Vite 代理到 `K_DATA_API_BASE_URL`：

- `GET /v1/sources`
- `GET /v1/artists`（`q`、`company`、`page`、`pageSize`）
- `GET /v1/artists/{id}`
- `GET /v1/artists/{id}/albums`
- `GET /v1/albums/{id}`
- `GET /v1/albums/{id}/tracks`
- `PATCH /v1/artists/{id}`（字段和/或 `mergeIntoId`）
- `GET /v1/ingest/failures`

## 构建 / 预览

```bash
pnpm build
pnpm preview
# 或
npm run build
npm run preview
```

预览同样监听 `127.0.0.1:15173`，并代理 `/v1`。也可用 `node server/serve.mjs` 在构建产物上提供登录 + API 代理。

## Docker（可选）

```bash
export ADMIN_PASSWORD='your-password'
# 容器访问宿主机上的 k-data-new：
export K_DATA_API_BASE_URL=http://host.docker.internal:28080
docker compose up --build
```

映射为 `127.0.0.1:15173`（仅本机）。

## 权限说明

使用模板自带的登录/角色壳，只播种一个 `admin` 用户，没有另造 RBAC 矩阵。

## 艺人头像与出处（必须遵守）

- 列表和详情默认用**艺人名称首字母**做圆形占位，**不**用 `<img>` 展示人脸或 `avatar_url` 照片。
- `avatar_url` 若由 API 返回，仅在详情中作为出处**文本/链接**保留；**禁止** 下载、镜像、CDN 缓存、本地存储图片二进制，也没有上传管线。
- `source_url`、`fetched_at` 原样来自 k-data-new。本仓库不发明抓取任务。
- 非 `http(s)` 的 `data:` / `blob:` 地址一律丢弃。
