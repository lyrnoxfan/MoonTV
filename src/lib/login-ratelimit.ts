/* eslint-disable no-console */

// 登录失败计数：IP + 用户名双维度，5 次失败后锁定 15 分钟。
//
// 存储：有 D1 绑定时用 login_attempts 表（跨实例生效，Pages 部署必需）；
// 无 D1 绑定（localstorage 模式 / 本地开发）时退回进程内 Map。
// 限速器自身故障时 fail-open（放行并记日志），绝不能把登录整个堵死。

import type { NextRequest } from 'next/server';

export const LOGIN_MAX_FAILS = 5;
export const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

// ---- D1 最小接口（与 src/lib/d1.db.ts 同构，不引入整个存储类） ----
// 只用 prepare / bind / first / run——这几个是线上已验证可用的原语；
// 不要用 db.exec()，它在 Pages edge 运行时里不可靠。
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}

function getD1(): D1Database | null {
  try {
    return (
      ((process.env as unknown as Record<string, unknown>).DB as D1Database) ||
      null
    );
  } catch {
    return null;
  }
}

let tableReady: Promise<void> | null = null;

async function ensureTable(db: D1Database): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .prepare(TABLE_SQL)
      .run()
      .then(() => undefined)
      .catch((err) => {
        // 建表失败不缓存，下次调用重试
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

// ---- 进程内兜底 ----
const memoryStore = new Map<string, { fails: number; updatedAt: number }>();

function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

export function buildLoginAttemptKey(ip: string, username: string): string {
  return `login:${ip}:${(username || '').trim()}`;
}

export function getLoginClientIp(req: NextRequest): string {
  return getClientIp(req);
}

function isExpired(updatedAt: number, now: number): boolean {
  return now - updatedAt >= LOGIN_LOCK_WINDOW_MS;
}

/** 当前窗口内的失败次数（过期算 0）。故障时返回 0（fail-open）。 */
export async function getLoginFails(key: string): Promise<number> {
  const now = Date.now();
  const db = getD1();
  if (db) {
    try {
      await ensureTable(db);
      const row = await db
        .prepare('SELECT fails, updated_at FROM login_attempts WHERE key = ?')
        .bind(key)
        .first<{ fails: number; updated_at: number }>();
      if (!row) return 0;
      if (isExpired(row.updated_at, now)) return 0;
      return row.fails;
    } catch (err) {
      console.error('读取登录失败计数失败（fail-open）:', err);
      return 0;
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return 0;
  if (isExpired(entry.updatedAt, now)) {
    memoryStore.delete(key);
    return 0;
  }
  return entry.fails;
}

/** 是否已锁定（失败 >= 5 且在 15 分钟窗口内）。故障时返回 false。 */
export async function isLoginLocked(key: string): Promise<boolean> {
  const fails = await getLoginFails(key);
  return fails >= LOGIN_MAX_FAILS;
}

/** 记录一次失败，返回累计次数。故障时返回 0。 */
export async function recordLoginFailure(key: string): Promise<number> {
  const now = Date.now();
  const db = getD1();
  if (db) {
    try {
      await ensureTable(db);
      const current = await getLoginFails(key);
      const next = current + 1;
      await db
        .prepare(
          'INSERT OR REPLACE INTO login_attempts (key, fails, updated_at) VALUES (?, ?, ?)'
        )
        .bind(key, next, now)
        .run();
      return next;
    } catch (err) {
      console.error('记录登录失败失败（fail-open）:', err);
      return 0;
    }
  }
  const entry = memoryStore.get(key);
  const current = entry && !isExpired(entry.updatedAt, now) ? entry.fails : 0;
  const next = current + 1;
  memoryStore.set(key, { fails: next, updatedAt: now });
  return next;
}

/** 登录成功后清零。 */
export async function clearLoginAttempts(key: string): Promise<void> {
  const db = getD1();
  if (db) {
    try {
      await ensureTable(db);
      await db
        .prepare('DELETE FROM login_attempts WHERE key = ?')
        .bind(key)
        .run();
      return;
    } catch (err) {
      console.error('清除登录失败计数失败:', err);
      return;
    }
  }
  memoryStore.delete(key);
}
