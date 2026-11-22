/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import {
  buildLoginAttemptKey,
  clearLoginAttempts,
  getLoginClientIp,
  isLoginLocked,
  LOGIN_MAX_FAILS,
  recordLoginFailure,
} from '@/lib/login-ratelimit';

export const runtime = 'edge';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'd1'
    | 'upstash'
    | undefined) || 'localstorage';

// 生成签名
async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // 导入密钥
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 生成签名
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 生成认证Cookie（带签名）
async function generateAuthCookie(
  username?: string,
  password?: string,
  role?: 'owner' | 'admin' | 'user',
  includePassword = false
): Promise<string> {
  const authData: any = { role: role || 'user' };

  // 只在需要时包含 password
  if (includePassword && password) {
    authData.password = password;
  }

  if (username && process.env.PASSWORD) {
    authData.username = username;
    // 使用密码作为密钥对用户名进行签名
    const signature = await generateSignature(username, process.env.PASSWORD);
    authData.signature = signature;
    authData.timestamp = Date.now(); // 添加时间戳防重放攻击
  }

  return encodeURIComponent(JSON.stringify(authData));
}

// 登录失败计数：累计到 5 次后本次直接回 429（锁定 15 分钟）。
async function countedFailure(key: string, response: NextResponse) {
  const fails = await recordLoginFailure(key);
  if (fails >= LOGIN_MAX_FAILS) {
    return NextResponse.json(
      { error: '尝试过于频繁，请 15 分钟后再试' },
      { status: 429 }
    );
  }
  return response;
}

export async function POST(req: NextRequest) {
  try {
    // 限速键：IP + 用户名（localstorage 模式无用户名，只按 IP 计）
    const body = await req.json().catch(() => ({}));
    const attemptKey = buildLoginAttemptKey(
      getLoginClientIp(req),
      typeof body.username === 'string' ? body.username : ''
    );
    if (await isLoginLocked(attemptKey)) {
      return NextResponse.json(
        { error: '尝试过于频繁，请 15 分钟后再试' },
        { status: 429 }
      );
    }

    // 本地 / localStorage 模式——仅校验固定密码
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.PASSWORD;

      // 未配置 PASSWORD 时直接放行
      if (!envPassword) {
        const response = NextResponse.json({ ok: true });

        // 清除可能存在的认证cookie
        response.cookies.set('auth', '', {
          path: '/',
          expires: new Date(0),
          sameSite: 'lax', // 改为 lax 以支持 PWA
          httpOnly: false, // PWA 需要客户端可访问
          secure: false, // 根据协议自动设置
        });

        return response;
      }

      const password = body.password;
      if (typeof password !== 'string') {
        return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return countedFailure(
          attemptKey,
          NextResponse.json({ ok: false, error: '密码错误' }, { status: 401 })
        );
      }

      // 验证成功，设置认证cookie
      const response = NextResponse.json({ ok: true });
      await clearLoginAttempts(attemptKey);
      const cookieValue = await generateAuthCookie(
        undefined,
        password,
        'user',
        true
      ); // localstorage 模式包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    }

    // 数据库 / redis 模式——校验用户名并尝试连接数据库
    const username = body.username;
    const password = body.password;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    // 可能是站长，直接读环境变量
    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      // 验证成功，设置认证cookie
      const response = NextResponse.json({ ok: true });
      await clearLoginAttempts(attemptKey);
      const cookieValue = await generateAuthCookie(
        username,
        password,
        'owner',
        false
      ); // 数据库模式不包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    } else if (username === process.env.USERNAME) {
      return countedFailure(
        attemptKey,
        NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
      );
    }

    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);
    if (user && user.banned) {
      return NextResponse.json({ error: '用户被封禁' }, { status: 401 });
    }

    // 校验用户密码
    try {
      const pass = await db.verifyUser(username, password);
      if (!pass) {
        return countedFailure(
          attemptKey,
          NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
        );
      }

      // 验证成功，设置认证cookie
      const response = NextResponse.json({ ok: true });
      await clearLoginAttempts(attemptKey);
      const cookieValue = await generateAuthCookie(
        username,
        password,
        user?.role || 'user',
        false
      ); // 数据库模式不包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    } catch (err) {
      console.error('数据库验证失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
