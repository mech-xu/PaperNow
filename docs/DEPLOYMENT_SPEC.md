# PaperNow 技术规范：Cloudflare Pages SPA 部署

## 1. 概述

PaperNow 是基于 UniApp + Vue3 构建的 H5 单页应用（SPA），使用 Vue Router 的 **history 模式**，部署在 **Cloudflare Pages** 上。

SPA 的核心特征是：所有路由由前端 JavaScript 在客户端处理，服务端只需返回同一个 `index.html`。但 Cloudflare Pages 作为静态文件托管服务，默认行为是按路径查找对应的静态文件，找不到则返回 404。

**问题**：当用户直接访问或刷新 SPA 子路由（如 `https://sunnynow.net/pages/search/index`）时，Cloudflare Pages 找不到 `/pages/search/index` 对应的静态文件，返回 404。

**解决方案**：通过 `_redirects` 文件配置路由重写规则，将所有非静态资源请求内部重写到 `index.html`。

---

## 2. _redirects 配置

### 2.1 文件位置

```
public/_redirects    → 构建时 Vite 自动复制到 → dist/_redirects
```

> **关键**：`_redirects` 文件必须位于构建输出目录（`dist/`）的**根路径**下。Vite 会将 `public/` 目录下的文件原样复制到 `dist/`，因此将 `_redirects` 放在 `public/` 目录即可。

### 2.2 文件内容

```
# 优先匹配静态资源，直接返回（不走重写逻辑，提升性能）
/assets/* /assets/:splat 200
/static/* /static/:splat 200
/favicon.ico /favicon.ico 200
/favicon.svg /favicon.svg 200
/robots.txt /robots.txt 200
/sitemap.xml /sitemap.xml 200

# 其余所有请求重写到 index.html（SPA fallback）
/* /index.html 200
```

### 2.3 配置解析

| 规则 | 含义 |
|------|------|
| `/assets/* /assets/:splat 200` | 静态资源（JS/CSS/字体/图片）直接返回，不走重写 |
| `/* /index.html 200` | 所有其他请求内部重写到 `index.html` |
| `200` 状态码 | **内部重写**（Rewrite），不是重定向（Redirect） |

### 2.4 为什么用 200 而不是 301/302

| 状态码 | 行为 | 是否适合 SPA |
|--------|------|-------------|
| **200** | 内部重写：服务端返回 `index.html` 的内容，但浏览器地址栏**保持不变** | ✅ 适合 |
| 301 | 永久重定向：浏览器地址栏变为 `/index.html`，且后续请求直接跳转 | ❌ 破坏 SPA |
| 302 | 临时重定向：浏览器地址栏变为 `/index.html`，增加额外网络请求 | ❌ 破坏 SPA |

---

## 3. _headers 配置

### 3.1 安全头

所有响应必须包含以下安全头：

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 3.2 缓存策略

| 资源类型 | 路径模式 | Cache-Control | 理由 |
|----------|----------|---------------|------|
| HTML | `/*.html`, `/index.html` | `no-cache, no-store, must-revalidate` | 确保用户始终获取最新版本 |
| JS/CSS | `/assets/*.js`, `/assets/*.css` | `public, max-age=31536000, immutable` | Vite 构建产物带 hash，内容不变则永久缓存 |
| 字体 | `/assets/*.woff2` | `public, max-age=31536000, immutable` | 字体文件几乎不变 |
| 图片 | `/assets/*.png` 等 | `public, max-age=86400` | 图片可能更新，缓存 1 天 |
| 元数据 | `/robots.txt`, `/sitemap.xml` | `public, max-age=86400` | 可能更新，缓存 1 天 |

---

## 4. Vite 构建配置

### 4.1 关键配置项

```typescript
// vite.config.ts
export default defineConfig({
  // public/ 目录下的文件构建时原样复制到 dist/
  publicDir: resolve(__dirname, 'public'),

  build: {
    // 输出到 dist/ 目录
    outDir: 'dist',
    // 静态资源存放于 dist/assets/，文件名带 hash
    assetsDir: 'assets',
  },
})
```

### 4.2 构建产物结构

```
dist/
├── index.html              # SPA 入口
├── _redirects              # Cloudflare Pages 路由重写规则 ← 从 public/ 复制
├── _headers                # Cloudflare Pages 安全头和缓存策略 ← 从 public/ 复制
├── robots.txt              # SEO ← 从 public/ 复制
├── assets/
│   ├── index-[hash].js     # 应用主 JS（带 hash，可永久缓存）
│   ├── index-[hash].css    # 应用主 CSS
│   ├── supabase-[hash].js  # Supabase SDK chunk
│   ├── vendor-[hash].js    # Vue/Pinia chunk
│   └── ...
└── static/                 # 其他静态资源
```

---

## 5. UniApp 路由配置

### 5.1 manifest.json

```json
{
  "h5": {
    "router": {
      "mode": "history",
      "base": "/"
    }
  }
}
```

- **`mode: "history"`**：使用 HTML5 History API，URL 无 `#` 号（如 `/pages/search/index`）
- **`base: "/"`**：路由基路径为根域名

> **注意**：不要使用 `hash` 模式。虽然 hash 模式不需要 `_redirects`（因为所有请求都指向 `/`），但 URL 中带 `#` 不利于 SEO 和分享。

---

## 6. CI/CD 部署验证

### 6.1 构建后验证（GitHub Actions）

在部署前，CI 流水线自动验证以下关键文件：

1. ✅ `dist/index.html` 存在 — SPA 入口
2. ✅ `dist/_redirects` 存在 — SPA 路由重写规则
3. ✅ `dist/_headers` 存在 — 安全头和缓存策略
4. ✅ `_redirects` 包含 `/* /index.html 200` — SPA fallback 规则

### 6.2 部署后验证

部署完成后，CI 流水线自动验证：

1. ✅ `https://sunnynow.net` 返回 HTTP 200 — 首页正常
2. ✅ `https://sunnynow.net/pages/search/index` 返回 HTTP 200 — SPA 子路由正常（_redirects 生效）
3. ✅ 响应包含 `Strict-Transport-Security` 头 — HSTS 已启用

### 6.3 手动验证步骤

```bash
# 1. 验证首页
curl -s -o /dev/null -w "%{http_code}" https://sunnynow.net
# 预期：200

# 2. 验证 SPA 子路由（关键！）
curl -s -o /dev/null -w "%{http_code}" https://sunnynow.net/pages/search/index
# 预期：200（如果返回 404，说明 _redirects 未生效）

# 3. 验证返回的是 index.html（而非 404 页面）
curl -s https://sunnynow.net/pages/search/index | head -5
# 预期：包含 <!DOCTYPE html> 和 <div id="app">

# 4. 验证浏览器地址栏保持不变
# 在浏览器中访问 https://sunnynow.net/pages/search/index
# 预期：地址栏仍为 /pages/search/index，页面正常渲染

# 5. 验证静态资源不走重写
curl -s -o /dev/null -w "%{http_code}" https://sunnynow.net/assets/index-abc123.js
# 预期：200（直接返回 JS 文件，而非 index.html）
```

---

## 7. 常见问题排查

### Q1: 部署后子路由返回 404

**原因**：`dist/_redirects` 文件不存在或内容错误

**排查**：
```bash
# 检查构建产物
ls -la dist/_redirects
cat dist/_redirects
```

**解决**：确保 `public/_redirects` 存在，重新构建部署

### Q2: 部署后子路由地址栏变为 /index.html

**原因**：`_redirects` 中使用了 301 或 302 状态码

**解决**：确保使用 `200` 状态码（内部重写，非重定向）

### Q3: 静态资源（JS/CSS）返回 index.html 内容

**原因**：`_redirects` 中 `/*` 规则优先于静态资源规则

**解决**：将静态资源规则放在 `/*` 之前（Cloudflare Pages 按顺序匹配）

### Q4: 构建后 dist/ 中没有 _redirects

**原因**：Vite 的 `publicDir` 配置不正确，或 `public/` 目录路径错误

**解决**：
```typescript
// vite.config.ts
export default defineConfig({
  publicDir: resolve(__dirname, 'public'),  // 确保指向正确的 public/ 目录
})
```

### Q5: 本地开发时子路由刷新 404

**原因**：Vite 开发服务器默认支持 SPA fallback，但如果配置了 `historyApiFallback` 可能冲突

**说明**：本地开发时 Vite 自动处理 SPA 路由，此问题仅在 Cloudflare Pages 部署后出现

---

## 8. 架构图

```
用户浏览器
    │
    │  访问 https://sunnynow.net/pages/search/index
    ▼
Cloudflare CDN (边缘节点)
    │
    │  查找 /pages/search/index 静态文件 → 未找到
    │  匹配 _redirects 规则: /* → /index.html [200]
    │  内部重写为 /index.html
    ▼
Cloudflare Pages
    │
    │  返回 index.html 内容 (HTTP 200)
    │  浏览器地址栏保持: /pages/search/index
    ▼
用户浏览器
    │
    │  加载 index.html → 执行 Vue Router
    │  Vue Router 解析 /pages/search/index
    │  渲染 SearchPage 组件
    ▼
用户看到搜索页面 ✅
```
