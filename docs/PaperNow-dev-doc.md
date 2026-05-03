PaperNow 项目开发文档 (AI Agent 友好版)
1. 项目概览
项目名称‌: PaperNow
核心定位‌: 面向全球科研人员的预印本文献管理与协作平台，专注于 H5 端轻量化体验，提供精准文献检索、个性化收藏管理与高效协作功能，彻底剥离微信生态依赖。
技术架构‌:
前端‌: UniApp + Vue 3 (H5 模式)
后端‌: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
基础设施‌: Cloudflare (Pages, DNS, CDN, R2)
域名‌: sunnynow.net (根域名直接托管于 Cloudflare Pages)
2. 核心功能描述
2.1 精准预印论文检索
支持多维度自定义搜索，覆盖科研人员核心需求：
多字段组合检索‌：可通过标题、摘要、关键词、学科分类、发布时间等字段精准定位文献，支持模糊匹配与精确匹配切换。
高级筛选功能‌：提供时间范围（近一周/近一月/自定义区间）、学科分类（自然科学/社会科学/工程技术等）、文献来源（arXiv/ChinaXiv 等主流预印本平台）等筛选条件，快速缩小检索范围。
智能排序‌：支持按发布时间、相关度、引用量等维度排序，默认展示最新研究成果。
2.2 个性化文献管理
注册用户可享受全流程文献管理服务：
收藏与标签‌：一键收藏感兴趣的文献，支持自定义标签分类，方便后续快速查找与整理。
本地保存‌：支持将文献摘要、关键段落或全文保存至个人空间，支持离线查看。
全文下载‌：对接主流预印本平台资源，注册用户可直接下载 PDF 格式全文，满足深度阅读需求。
阅读记录‌：自动记录文献阅读进度，再次打开时可直接跳转至上次阅读位置。
2.3 协作与分享
文献分享‌：支持通过链接将文献分享至社交媒体或协作群组，分享内容可自定义为摘要、全文链接或个人笔记。
协作空间‌：创建专属协作文件夹，邀请团队成员共同管理文献，支持实时同步收藏与标注内容。
3. 技术栈与规范
3.1 前端规范 (UniApp Vue3 H5)
由于移除了微信生态，前端将完全基于标准 Web 技术栈，不再包含任何微信 JS-SDK、OAuth 授权或小程序特有 API。
3.1.1 项目结构
text
paperNow-uniapp/
├── src/
│   ├── pages/           # 页面路由
│   │   ├── index.vue    # 首页/文献检索
│   │   ├── detail.vue   # 文献详情/阅读页
│   │   ├── library.vue  # 个人文献库
│   │   └── login.vue    # 邮箱/社交登录页
│   ├── components/      # 通用组件
│   ├── stores/          # Pinia 状态管理
│   ├── utils/
│   │   ├── supabase.ts  # Supabase 客户端初始化
│   │   └── request.ts   # 统一请求封装
│   ├── App.vue
│   ├── main.ts
│   └── manifest.json    # 配置 H5 基础路径为 '/'
├── public/              # 静态资源
├── vite.config.ts       # Vite 构建配置
└── package.json
3.1.2 关键配置变更
移除微信依赖‌: 删除 manifest.json 中所有微信小程序相关配置 (mp-weixin)。
路由模式‌: 启用 history 模式，配合 Cloudflare Pages 的重写规则，确保刷新页面不报 404。
认证方式‌: 仅保留 Supabase 原生支持的邮箱密码登录、GitNow/Google OAuth 登录。
3.2 后端规范 (Supabase)
数据库‌: PostgreSQL，核心表结构包括：
users：用户基础信息
documents：检索到的文献元数据（标题、摘要、发布时间等）
user_collections：用户收藏关系表
user_tags：用户自定义标签表
认证‌: Supabase Auth (禁用微信登录提供商)
存储‌: Supabase Storage (用于用户上传的笔记、标注文件) 或 Cloudflare R2 (用于大文件备份，通过 Edge Function 中转)
安全‌: 严格配置 Row Level Security (RLS)，确保用户仅能访问自身收藏与协作内容。
3.3 基础设施规范 (Cloudflare)
DNS‌: sunnynow.net A/AAAA 记录指向 Cloudflare Pages。
SSL‌: 强制 HTTPS，启用 HSTS。
Pages‌:
构建命令: npm run build:h5
输出目录: dist/build/h5
重定向规则: _redirects 文件中配置 /* /index.html 200 以支持 SPA 路由。
4. CI/CD 自动化流程
采用 ‌GitNow Actions‌ 作为 CI/CD 引擎，实现代码提交后自动构建并部署至 Cloudflare Pages。
4.1 环境变量配置 (GitNow Secrets)
在 GitNow 仓库 Settings -> Secrets and variables -> Actions 中配置：
CLOUDFLARE_API_TOKEN: Cloudflare API Token (需拥有 Pages 编辑权限)
CLOUDFLARE_ACCOUNT_ID: Cloudflare Account ID
VITE_SUPABASE_URL: Supabase 项目 URL
VITE_SUPABASE_ANON_KEY: Supabase 匿名 Key
4.2 GitNow Actions 工作流 (.gitNow/workflows/deploy.yml)
yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint and Type Check
        run: |
          npm run lint
          npm run type-check

      - name: Build H5
        run: npm run build:h5
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        if: gitNow.ref == 'refs/heads/main'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist/build/h5 --project-name=paperNow --branch=main
4.3 构建优化策略
依赖缓存‌: 使用 actions/cache 或 setup-node 的内置缓存功能加速 node_modules 安装。
并行检查‌: Lint 和 Type Check 可与构建并行执行（若拆分为不同 job），但在单 job 中串行以确保错误早期阻断。
Source Map‌: 生产环境禁用 Source Map (vite.config.ts 中设置 build.sourcemap: false) 以减小包体积并加快上传速度。
5. 实施计划
阶段一：基础架构与核心功能搭建 (Week 1-2)
项目初始化‌: 创建 UniApp Vue3 项目，仅选择 H5 平台。
预印本检索模块‌: 集成多源预印本数据接口，实现标题、摘要、关键词等字段检索与筛选功能。
Supabase 集成‌:
创建项目，配置 Email/Password 和 GitNow OAuth 提供商。
设计 documents、user_collections 等核心表结构，启用 RLS。
Cloudflare 配置‌:
绑定域名 sunnynow.net 到 Cloudflare。
创建 Pages 项目，手动上传一次初始构建产物以验证连通性。
阶段二：个性化功能开发 (Week 3-4)
用户中心模块‌: 实现基于 Supabase Auth 的登录、注册、找回密码页面。
文献管理功能‌:
开发收藏、标签分类、本地保存功能。
对接预印本平台资源，实现 PDF 全文下载。
协作功能‌: 开发文献分享与协作空间创建功能，支持团队成员邀请与内容同步。
阶段三：CI/CD 与优化 (Week 5)
配置 GitNow Actions‌: 编写并测试 deploy.yml，确保推送代码后自动部署。
性能优化‌:
启用 Cloudflare CDN 缓存策略，优化检索接口响应速度。
对前端资源进行 Gzip/Brotli 压缩，优化移动端加载体验。
全局测试‌:
在不同浏览器 (Chrome, Safari, Firefox) 测试兼容性。
验证移动端 H5 响应式布局与功能完整性。
测试 CI/CD 流水线的稳定性。
6. AI Agent 交互指令集
为了便于 AI Agent 协助开发，定义以下标准指令格式：
6.1 代码生成
markdown
<action>generate_code</action>
<module>frontend_component</module>
<description>创建一个文献检索结果卡片组件，显示标题、作者、发布时间、摘要预览，支持收藏按钮</description>
<tech_stack>Vue3, TailwindCSS, Supabase JS Client</tech_stack>
6.2 数据库设计
markdown
<action>design_schema</action>
<table_name>user_collections</table_name>
<requirements>
- user_id (UUID, FK)
- document_id (UUID, FK)
- tag_ids (UUID[], 关联 user_tags 表)
- created_at (timestamp)
- 启用 RLS: 用户只能查看自己的收藏记录
</requirements>
6.3 CI/CD 调试
markdown
<action>debug_ci</action>
<error_log>Build failed: Cannot find module '@dcloudio/uni-cli-shared'</error_log>
<context>GitNow Actions runner, Node 20, npm ci</context>
6.4 安全审计
markdown
<action>audit_security</action>
<focus>RLS Policies</focus>
<table>user_collections</table>
<goal>Ensure users can only access their own collection records</goal>
7. 注意事项
域名解析‌: 确保 sunnynow.net 的 DNS 代理状态为 "Proxied" (橙色云)，以启用 Cloudflare 的安全和加速功能。
SPA 路由‌: Cloudflare Pages 默认不支持 SPA 路由重写，必须在项目根目录添加 _redirects 文件，内容为 /* /index.html 200。
环境变量‌: 前端敏感信息 (如 Supabase Anon Key) 是公开的，但务必不要将 Service Role Key 泄露到前端或 GitNow 代码中。
资源合规‌: 预印本资源的下载与分享需严格遵守原平台版权规定，避免侵权风险。