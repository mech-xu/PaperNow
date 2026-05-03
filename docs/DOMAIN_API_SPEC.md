# PaperNow 域名与 API 规范文档

## 1. 架构选型：模式 A — 功能优先

采用 `<project>.<domain>` / `api.<project>.<domain>` 结构，按业务线隔离。

**选型理由：**
- `sunnynow.net` 未来可能承载多个子项目（PaperNow、NeighborNow 等），需按业务线隔离
- 每个项目可独立配置 DNS、CDN、监控策略
- JWT (Bearer Token) 认证天然适合子域名分离，无 Cookie 域问题
- Cloudflare DNS + Pages + Workers 完美支持子域名 CNAME

---

## 2. 域名规划

### 2.1 环境域名矩阵

| 环境 | 前端 (H5 SPA) | API (Worker) | 用途 |
|------|---------------|-------------|------|
| **生产 (Prod)** | `papernow.sunnynow.net` | `api.papernow.sunnynow.net` | 正式用户访问 |
| **开发 (Dev)** | `dev.papernow.sunnynow.net` | `api-dev.papernow.sunnynow.net` | 日常开发调试 |
| **本地** | `localhost:5173` | `localhost:8787` | 本地开发 |

### 2.2 DNS 记录规划

| 子域名 | 类型 | 目标 | 服务 |
|--------|------|------|------|
| `papernow` | CNAME | `papernow.pages.dev` | Cloudflare Pages (前端) |
| `api.papernow` | CNAME | `papernow-api.workers.dev` | Cloudflare Worker (API) |
| `dev.papernow` | CNAME | `papernow-dev.pages.dev` | Cloudflare Pages (开发) |
| `api-dev.papernow` | CNAME | `papernow-api-dev.workers.dev` | Cloudflare Worker (开发) |

### 2.3 命名规范

| 规则 | 正确 | 错误 |
|------|------|------|
| 小写字母 + 连字符 | `api-dev.papernow.sunnynow.net` | `ApiDev.papernow.sunnynow.net` |
| 不用下划线 | `api.papernow` | `api_papernow` |
| 通用缩写可接受 | `api`, `dev`, `cdn`, `auth` | `ap`, `dv` |
| 生产环境无前缀 | `papernow.sunnynow.net` | `prod.papernow.sunnynow.net` |

---

## 3. API 路径规范 (RESTful)

### 3.1 基础结构

```
https://api.papernow.sunnynow.net/v1/{resource}
```

- **域名**: `api.papernow.sunnynow.net`（按项目隔离）
- **版本**: `/v1`（URL 版本控制，平滑升级）
- **资源**: 名词复数，kebab-case

### 3.2 API 端点设计

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查 | 无 |
| GET | `/v1/papers` | 文献列表/搜索 | 无 |
| GET | `/v1/papers/:id` | 文献详情 | 无 |
| POST | `/v1/papers/ingest` | 文献元数据入库 | service_role |
| GET | `/v1/papers/:id/pdf` | PDF 代理下载 | Bearer Token |
| GET | `/v1/collections/:token` | 分享链接解析 | 无 |

> **注意**: 大部分数据操作由前端直连 Supabase（受 RLS 保护），Worker API 仅处理需要 service_role 权限的操作。

### 3.3 命名规范

| 规则 | 正确 | 错误 |
|------|------|------|
| 名词复数表示集合 | `GET /v1/papers` | `GET /v1/paper` |
| kebab-case 路径 | `/v1/user-profiles` | `/v1/userProfiles` |
| 动词通过 HTTP Method | `POST /v1/papers` | `POST /v1/createPaper` |
| 版本号在路径中 | `/v1/papers` | `/papers` (无版本) |

### 3.4 响应格式

```typescript
// 成功响应
{
  "data": T,
  "meta": { "page": 1, "pageSize": 20, "total": 100 }
}

// 错误响应
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Paper with id xxx not found",
    "documentation": "https://papernow.sunnynow.net/docs/api"
  }
}
```

---

## 4. CORS 与安全配置

### 4.1 CORS 策略

| 环境 | Access-Control-Allow-Origin | 说明 |
|------|---------------------------|------|
| **生产** | `https://papernow.sunnynow.net` | 严格限制，禁止通配符 |
| **开发** | `http://localhost:5173` | 本地开发前端 |

### 4.2 Cookie 域隔离

- PaperNow 使用 **JWT (Bearer Token)** 认证，不依赖 Cookie
- 前端 (`papernow.sunnynow.net`) 和 API (`api.papernow.sunnynow.net`) 在不同子域
- JWT 通过 `Authorization: Bearer <token>` 头传递，天然跨子域兼容

### 4.3 HSTS

所有子域名启用 HSTS preload：
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 5. Supabase Auth 回调配置

| 配置项 | 值 |
|--------|-----|
| Site URL | `https://papernow.sunnynow.net` |
| Redirect URLs | `https://papernow.sunnynow.net/**` |
| GitHub OAuth Callback | `https://papernow.sunnynow.net/auth/callback` |
| 本地开发 | `http://localhost:5173/**` |

---

## 6. Cloudflare 部署配置

### 6.1 Pages 项目 (前端)

| 配置项 | 值 |
|--------|-----|
| Project Name | `papernow` |
| Custom Domain | `papernow.sunnynow.net` |
| Build Command | `npm run build:prod` |
| Output Directory | `dist` |
| _redirects | `/* /index.html 200` (SPA fallback) |

### 6.2 Worker 项目 (API)

| 配置项 | 值 |
|--------|-----|
| Worker Name | `papernow-api` |
| Custom Domain | `api.papernow.sunnynow.net` |
| Route Pattern | `api.papernow.sunnynow.net/*` |

---

## 7. 扩展性：未来子项目

当 `sunnynow.net` 下新增子项目时，遵循相同规范：

| 项目 | 前端 | API |
|------|------|-----|
| PaperNow | `papernow.sunnynow.net` | `api.papernow.sunnynow.net` |
| NeighborNow | `neighbornow.sunnynow.net` | `api.neighbornow.sunnynow.net` |
| Blog | `blog.sunnynow.net` | `api.blog.sunnynow.net` |

每个项目独立 DNS 记录、独立 Cloudflare Pages/Worker、独立 Supabase 项目，完全隔离。
