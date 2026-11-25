/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useScrolled } from '@/hooks/useScrolled';

import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface NavItem {
  label: string;
  href: string;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/' },
  { label: '电影', href: '/douban?type=movie' },
  { label: '剧集', href: '/douban?type=tv' },
  { label: '综艺', href: '/douban?type=show' },
];

interface TopNavProps {
  /** 首页 Hero 铺在顶栏下方时，未滚动保持透明 */
  transparentAtTop?: boolean;
}

export default function TopNav({ transparentAtTop = false }: TopNavProps) {
  const { siteName } = useSite();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrolled = useScrolled(8);
  const [query, setQuery] = useState('');
  const [navItems, setNavItems] = useState<NavItem[]>(BASE_NAV_ITEMS);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setNavItems([
        ...BASE_NAV_ITEMS,
        { label: '自定义', href: '/douban?type=custom' },
      ]);
    }
  }, []);

  const solid = !transparentAtTop || scrolled;
  const fullPath = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    const typeMatch = href.match(/type=([^&]+)/)?.[1];
    const decodedActive = decodeURIComponent(fullPath);
    const decodedHref = decodeURIComponent(href);
    return (
      decodedActive === decodedHref ||
      (decodedActive.startsWith('/douban') &&
        typeMatch !== undefined &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <header
      className={`sticky top-0 z-40 hidden h-16 border-b transition-[background-color,border-color] duration-300 md:block ${
        solid
          ? 'border-gray-200/70 bg-gray-50/90 backdrop-blur-xl dark:border-white/[0.06] dark:bg-gray-950/90'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className='mx-auto flex h-full w-full max-w-[1680px] items-center gap-5 px-4 sm:px-8 lg:gap-8 xl:px-12'>
        <Link
          href='/'
          className='flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80'
        >
          <Image
            src='/logo.png'
            alt={siteName}
            width={32}
            height={32}
            className='h-8 w-8 rounded-lg object-contain'
          />
          <span
            className={`text-lg font-semibold tracking-tight ${
              solid ? 'text-gray-900 dark:text-white' : 'text-white'
            }`}
          >
            {siteName}
          </span>
        </Link>

        <nav className='flex items-center gap-1 lg:gap-2'>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center px-3 py-2 text-[15px] transition-colors ${
                  active
                    ? solid
                      ? 'font-semibold text-brand-600 dark:text-brand-400'
                      : 'font-semibold text-white'
                    : solid
                    ? 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {item.label}
                <span
                  className={`mt-1 h-[3px] w-4 rounded-full bg-brand-500 transition-opacity dark:bg-brand-400 ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <form
          className='ml-auto hidden lg:block'
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) {
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            } else {
              router.push('/search');
            }
          }}
        >
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 ${
              solid
                ? 'bg-gray-900/[0.06] text-gray-700 dark:bg-white/10 dark:text-gray-200'
                : 'bg-white/15 text-white'
            }`}
          >
            <Search className='h-4 w-4 shrink-0 opacity-70' />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='搜索影片'
              className={`w-64 bg-transparent text-sm outline-none xl:w-80 ${
                solid
                  ? 'placeholder:text-gray-400 dark:placeholder:text-gray-500'
                  : 'placeholder:text-white/60'
              }`}
            />
          </div>
        </form>

        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
