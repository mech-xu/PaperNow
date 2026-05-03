#!/bin/bash
# ============================================
# T2: Supabase 数据库初始化指南
# ============================================
# 
# 由于 Supabase 不暴露 SQL 执行 REST API，
# 需要通过以下方式之一执行 schema：
#
# 方式 1（推荐）: Supabase Dashboard SQL Editor
# 方式 2: Supabase CLI (需要 Access Token)
# 方式 3: psql 直连 (需要正确密码)
#
# ============================================

echo "============================================"
echo "PaperHub T2: Supabase 数据库初始化"
echo "============================================"
echo ""
echo "项目 Ref: yaywgfpmgjapyhsykfco"
echo "Dashboard: https://supabase.com/dashboard/project/yaywgfpmgjapyhsykfco"
echo "SQL File: database/migrations/001_initial_schema.sql"
echo ""
echo "--------------------------------------------"
echo "方式 1: Supabase Dashboard SQL Editor (推荐)"
echo "--------------------------------------------"
echo "1. 打开 https://supabase.com/dashboard/project/yaywgfpmgjapyhsykfco/sql/new"
echo "2. 复制 database/migrations/001_initial_schema.sql 全部内容"
echo "3. 粘贴到 SQL Editor"
echo "4. 点击 Run 执行"
echo ""
echo "--------------------------------------------"
echo "方式 2: Supabase CLI"
echo "--------------------------------------------"
echo "1. 获取 Access Token: https://supabase.com/dashboard/account/tokens"
echo "2. 运行: npx supabase login"
echo "3. 运行: npx supabase link --project-ref yaywgfpmgjapyhsykfco"
echo "4. 运行: npx supabase db push"
echo ""
echo "--------------------------------------------"
echo "方式 3: psql 直连"
echo "--------------------------------------------"
echo "1. 在 Dashboard → Settings → Database 获取连接字符串"
echo "2. 运行: psql \"<connection_string>\" -f database/migrations/001_initial_schema.sql"
echo ""
echo "============================================"
echo "执行后验证步骤"
echo "============================================"
echo "1. 在 Table Editor 确认 8 张表存在"
echo "2. 在 SQL Editor 运行: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'"
echo "3. 在 SQL Editor 运行: SELECT * FROM search_documents('test', p_limit := 5)"
echo "4. 在 Authentication → URL Configuration 确认 Site URL = https://paperhub.sunnynow.net"
echo "5. 在 Authentication → Providers 确认 Email 已启用"
echo ""
echo "============================================"
echo "Auth 配置 (Dashboard 操作)"
echo "============================================"
echo "1. Authentication → URL Configuration:"
echo "   - Site URL: https://paperhub.sunnynow.net"
echo "   - Redirect URLs: https://paperhub.sunnynow.net/**, http://localhost:5173/**"
echo ""
echo "2. Authentication → Providers:"
echo "   - Email: ✅ Enable"
echo "   - GitHub: ⬜ Enable (需要先创建 GitHub OAuth App)"
echo ""
echo "3. GitHub OAuth App 创建 (将来):"
echo "   - https://github.com/settings/developers → New OAuth App"
echo "   - Application name: PaperHub"
echo "   - Homepage URL: https://paperhub.sunnynow.net"
echo "   - Authorization callback URL: https://yaywgfpmgjapyhsykfco.supabase.co/auth/v1/callback"
echo "   - 获取 Client ID + Client Secret → 填入 Supabase GitHub Provider"
