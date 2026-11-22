/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  console.log('server-config called: ', request.url);

  const config = await getConfig();
  // 只返回前端启动必需字段；StorageType / IMAGE_PROXY / DOUBAN_PROXY
  // 等后端细节一律不下发（此前直接暴露持久化后端为 D1）。
  const result = {
    SiteName: config.SiteConfig.SiteName,
    ENABLE_REGISTER: config.UserConfig.AllowRegister,
  };
  return NextResponse.json(result);
}
