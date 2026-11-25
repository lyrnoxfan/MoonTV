'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useScrolled } from '@/hooks/useScrolled';

import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
  /** 首页 Hero 铺在顶栏下方时，未滚动保持透明 */
  transparentAtTop?: boolean;
}

const MobileHeader = ({
  showBackButton = false,
  transparentAtTop = false,
}: MobileHeaderProps) => {
  const { siteName } = useSite();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const scrolled = useScrolled(8);
  const transparent = transparentAtTop && !scrolled;

  return (
    <header
      className={`sticky top-0 z-40 h-12 border-b transition-[background-color,border-color] duration-300 md:hidden ${
        transparent
          ? 'border-transparent bg-transparent'
          : 'border-gray-200/70 bg-gray-50/90 backdrop-blur-xl dark:border-white/[0.06] dark:bg-gray-950/90'
      }`}
    >
      <div className='flex h-12 items-center gap-2 px-4'>
        {showBackButton && <BackButton />}

        <Link
          href='/'
          className='flex shrink-0 items-center gap-1.5 transition-opacity hover:opacity-80'
        >
          <Image
            src='/logo.png'
            alt={siteName}
            width={28}
            height={28}
            className='h-7 w-7 rounded-md object-contain'
          />
          <span
            className={`text-base font-semibold tracking-tight ${
              transparent ? 'text-white' : 'text-gray-900 dark:text-white'
            }`}
          >
            {siteName}
          </span>
        </Link>

        <form
          className='min-w-0 flex-1'
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
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
              transparent
                ? 'bg-white/15 text-white'
                : 'bg-gray-900/[0.06] text-gray-700 dark:bg-white/10 dark:text-gray-200'
            }`}
          >
            <Search className='h-4 w-4 shrink-0 opacity-70' />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='搜索影片'
              className={`min-w-0 w-full bg-transparent text-sm outline-none ${
                transparent
                  ? 'placeholder:text-white/60'
                  : 'placeholder:text-gray-400 dark:placeholder:text-gray-500'
              }`}
            />
          </div>
        </form>

        <div className='flex shrink-0 items-center gap-2'>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
