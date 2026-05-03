# Supabase 数据库设置步骤

## 方法：通过 Supabase Dashboard 手动执行

由于 CLI 登录需要交互式环境，请按以下步骤在 Dashboard 中执行：

### 步骤 1: 登录 Dashboard

1. 访问 https://supabase.com/dashboard
2. 点击你的项目 `spsnhqhluwqyaaadowgx`
3. 进入项目控制台

### 步骤 2: 打开 SQL Editor

1. 点击左侧菜单 **SQL Editor**
2. 点击 **New query**
3. 复制下面的 SQL 代码

### 步骤 3: 执行 SQL

将以下内容复制到 SQL Editor 中，然后点击 **Run**：

```sql
-- ============================================
-- 1. 启用扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. 创建表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    openid TEXT UNIQUE,
    phone TEXT UNIQUE,
    nickname TEXT,
    avatar_url TEXT,
    community TEXT,
    contact_wechat TEXT,
    contact_whatsapp TEXT,
    contact_telegram TEXT,
    contact_email TEXT,
    preferred_contact TEXT DEFAULT 'wechat',
    location GEOGRAPHY(POINT, 4326),
    address TEXT,
    trust_score INTEGER DEFAULT 20,
    help_given INTEGER DEFAULT 0,
    help_received INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_type TEXT NOT NULL CHECK (post_type IN ('request', 'offer')),
    category TEXT NOT NULL CHECK (category IN ('pet', 'car', 'food', 'item', 'service', 'other')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    images TEXT[],
    location GEOGRAPHY(POINT, 4326),
    address TEXT,
    reward TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 回复表
CREATE TABLE IF NOT EXISTS replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    reply_type TEXT DEFAULT 'comment' CHECK (reply_type IN ('comment', 'offer_help', 'question')),
    share_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 私信表
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. 创建索引
-- ============================================
CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_location ON users USING GIST(location);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_replies_post_id ON replies(post_id);

-- ============================================
-- 4. 创建函数
-- ============================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 获取附近帖子
CREATE OR REPLACE FUNCTION get_nearby_posts(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_meters INTEGER DEFAULT 5000,
    p_category TEXT DEFAULT NULL,
    p_post_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    post_type TEXT,
    category TEXT,
    title TEXT,
    description TEXT,
    images TEXT[],
    address TEXT,
    reward TEXT,
    status TEXT,
    view_count INTEGER,
    reply_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    distance_meters DECIMAL,
    author_nickname TEXT,
    author_community TEXT,
    author_trust_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.post_type,
        p.category,
        p.title,
        p.description,
        p.images,
        p.address,
        p.reward,
        p.status,
        p.view_count,
        p.reply_count,
        p.created_at,
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::GEOGRAPHY) as distance_meters,
        u.nickname as author_nickname,
        u.community as author_community,
        u.trust_score as author_trust_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE 
        p.location IS NOT NULL
        AND ST_DWithin(
            p.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::GEOGRAPHY,
            radius_meters
        )
        AND p.status = 'open'
        AND (p_category IS NULL OR p.category = p_category)
        AND (p_post_type IS NULL OR p.post_type = p_post_type)
    ORDER BY distance_meters ASC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 插入测试数据
-- ============================================

-- 测试用户 (Sunny)
INSERT INTO users (id, phone, nickname, community, contact_wechat, trust_score, location, address)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '+14168007470',
    'Sunny',
    'North York',
    'sunny_xu_ca',
    50,
    ST_SetSRID(ST_MakePoint(-79.4131, 43.7615), 4326)::GEOGRAPHY,
    'North York, Toronto'
)
ON CONFLICT (id) DO NOTHING;

-- 测试帖子
INSERT INTO posts (id, user_id, post_type, category, title, description, reward, location, address)
VALUES 
    (uuid_generate_v4(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'request', 'pet', '帮忙遛狗', '明天下午3-5点需要帮忙遛狗，一只金毛，很乖的', '$20', ST_SetSRID(ST_MakePoint(-79.4131, 43.7615), 4326)::GEOGRAPHY, 'North York Centre附近'),
    (uuid_generate_v4(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'request', 'car', '借车搬家', '下周六需要借一辆SUV搬家，大概2小时', '请吃饭+油费', ST_SetSRID(ST_MakePoint(-79.2486, 43.7764), 4326)::GEOGRAPHY, 'Scarborough Town Centre附近'),
    (uuid_generate_v4(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'offer', 'service', '免费教中文', '可以提供免费的中文教学，帮助新移民孩子', '免费', ST_SetSRID(ST_MakePoint(-79.4131, 43.7615), 4326)::GEOGRAPHY, 'North York');

-- 验证
SELECT 'Setup completed!' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as post_count FROM posts;
```

### 步骤 4: 验证

执行后应该看到：
- `Setup completed!`
- `user_count: 1`
- `post_count: 3`

### 步骤 5: 测试 API

在 Dashboard 的 **Table Editor** 中查看：
1. 点击 **Database** → **Tables**
2. 应该看到 `users`, `posts`, `replies`, `messages` 表
3. 点击 `users` 表，应该看到 Sunny 的测试数据

---

## 下一步

数据库创建完成后，部署 Cloudflare Worker：

```bash
cd /Users/sunny/WorkBuddy/20260311153814/neighbourhub/worker
npx wrangler deploy
```

然后测试 API：
```bash
curl https://neighbourpaw-api.sunny-xu-ca.workers.dev/api/health
```
