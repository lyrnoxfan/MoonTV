import {
  buildLoginAttemptKey,
  clearLoginAttempts,
  getLoginFails,
  isLoginLocked,
  LOGIN_MAX_FAILS,
  recordLoginFailure,
} from './login-ratelimit';

// 无 D1 绑定时走进程内 Map（测试环境即如此）
describe('login-ratelimit', () => {
  const key = buildLoginAttemptKey('1.2.3.4', 'alice');

  beforeEach(async () => {
    await clearLoginAttempts(key);
  });

  it('前 4 次失败不锁定，第 5 次后锁定', async () => {
    for (let i = 1; i <= 4; i++) {
      const fails = await recordLoginFailure(key);
      expect(fails).toBe(i);
      expect(await isLoginLocked(key)).toBe(false);
    }
    const fails = await recordLoginFailure(key);
    expect(fails).toBe(LOGIN_MAX_FAILS);
    expect(await isLoginLocked(key)).toBe(true);
  });

  it('成功登录清零后不再锁定', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) {
      await recordLoginFailure(key);
    }
    expect(await isLoginLocked(key)).toBe(true);
    await clearLoginAttempts(key);
    expect(await getLoginFails(key)).toBe(0);
    expect(await isLoginLocked(key)).toBe(false);
  });

  it('不同 IP / 用户名互不干扰', async () => {
    const other = buildLoginAttemptKey('5.6.7.8', 'alice');
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) {
      await recordLoginFailure(key);
    }
    expect(await isLoginLocked(key)).toBe(true);
    expect(await isLoginLocked(other)).toBe(false);
  });
});
