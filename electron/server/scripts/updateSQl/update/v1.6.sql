-- v1.6 升级脚本
-- 在 message 表中添加 is_round_end 字段

-- 添加 is_round_end 列
ALTER TABLE message ADD COLUMN is_round_end BOOLEAN DEFAULT 0;

-- 设置数据库版本
PRAGMA user_version = 106;

