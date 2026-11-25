'use client';

import { ExternalLink, Play, Star } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { processImageUrl } from '@/lib/utils';

export interface HeroItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
  type: 'movie' | 'tv' | 'show';
  typeLabel: string;
}

const ROTATE_INTERVAL_MS = 8000;

interface HomeHeroProps {
  items: HeroItem[];
  loading?: boolean;
}

/**
 * 首页 Hero 轮播（IceTV 式）：
 * 桌面端模糊海报底 + 左侧海报卡 + 右下缩略图切换；
 * 移动端海报原图铺满 + 圆点切换。数据只用热门列表已有的
 * 字段（标题/海报/评分/年份/类型），不额外拉详情。
 */
export default function HomeHero({ items, loading = false }: HomeHeroProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = items.length;
  const active = count > 0 ? items[index % count] : null;

  const goTo = useCallback(
    (i: number) => {
      if (count > 0) setIndex(((i % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => {
      if (document.hidden || paused) return;
      setIndex((prev) => (prev + 1) % count);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (loading || !active) {
    return (
      <section className='relative -mt-12 h-[460px] animate-pulse bg-gray-200 md:-mt-16 md:h-[clamp(440px,58vh,560px)] dark:bg-gray-800' />
    );
  }

  const handlePlay = () => {
    router.push(
      `/play?title=${encodeURIComponent(active.title.trim())}${
        active.year ? `&year=${active.year}` : ''
      }${active.type === 'movie' ? '&stype=movie' : ''}`
    );
  };

  const backdropUrl = processImageUrl(active.poster);

  return (
    <section
      className='relative -mt-12 overflow-hidden md:-mt-16'
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 背景：移动端海报原图铺满 */}
      <div className='absolute inset-0 md:hidden'>
        <Image
          key={`m-${active.poster}`}
          src={backdropUrl}
          alt=''
          fill
          priority
          className='object-cover object-[center_20%]'
          referrerPolicy='no-referrer'
        />
        <div className='absolute inset-0 bg-gradient-to-t from-gray-50 via-gray-50/30 to-transparent dark:from-gray-950 dark:via-gray-950/30' />
        <div className='absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent' />
      </div>
      {/* 背景：桌面端模糊放大海报 */}
      <div className='absolute inset-0 hidden md:block'>
        <Image
          key={`d-${active.poster}`}
          src={backdropUrl}
          alt=''
          fill
          priority
          className='scale-125 object-cover blur-3xl brightness-[0.45] saturate-150'
          referrerPolicy='no-referrer'
        />
        <div className='absolute inset-0 bg-black/30' />
        <div className='absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent dark:from-gray-950 dark:via-transparent' />
      </div>

      {/* 内容 */}
      <div className='relative mx-auto flex min-h-[460px] w-full max-w-[1680px] items-end px-4 pb-10 pt-20 sm:px-8 md:h-[clamp(440px,58vh,560px)] md:min-h-0 md:pt-28 xl:px-12'>
        <div className='flex items-end gap-6 lg:gap-10'>
          {/* 海报卡（桌面端） */}
          <div className='relative hidden aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20 md:block lg:w-56'>
            <Image
              src={backdropUrl}
              alt={active.title}
              fill
              priority
              className='object-cover'
              referrerPolicy='no-referrer'
            />
          </div>

          {/* 文案 */}
          <div className='min-w-0 max-w-2xl flex-1 pb-1'>
            <span className='inline-flex rounded bg-brand-500 px-2 py-0.5 text-xs font-medium text-white'>
              {active.typeLabel}
            </span>
            <h1 className='mt-2 text-[28px] font-bold leading-tight text-white md:text-4xl lg:text-5xl lg:leading-tight'>
              {active.title}
            </h1>
            <p className='mt-2 flex items-center gap-2 text-[13px] text-white/80 md:mt-3 md:text-[15px]'>
              {active.rate && (
                <span className='inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums text-amber-400'>
                  <Star className='h-[1em] w-[1em] fill-current' />
                  {active.rate}
                </span>
              )}
              <span className='truncate'>
                {[active.year, active.typeLabel].filter(Boolean).join(' · ')}
              </span>
            </p>
            <div className='mt-4 flex items-center gap-2.5 md:mt-7 md:gap-3'>
              <button
                type='button'
                onClick={handlePlay}
                className='inline-flex h-10 items-center gap-2 rounded-full bg-brand-500 pl-4 pr-5 text-sm font-medium text-white transition-colors hover:bg-brand-600 md:h-11 md:text-[15px]'
              >
                <Play className='h-4 w-4 fill-current' />
                立即播放
              </button>
              <a
                href={`https://movie.douban.com/subject/${active.id}`}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/15 md:h-11 md:text-[15px]'
              >
                豆瓣
                <ExternalLink className='h-4 w-4' />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 缩略图切换（桌面端） */}
      <div className='absolute bottom-8 right-4 z-10 hidden gap-2 sm:right-8 md:flex xl:right-12'>
        {items.map((item, i) => (
          <button
            key={item.id}
            type='button'
            onClick={() => goTo(i)}
            aria-label={item.title}
            className={`relative aspect-[2/3] w-14 overflow-hidden rounded-md transition-all ${
              i === index % count
                ? 'ring-2 ring-white'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <Image
              src={processImageUrl(item.poster)}
              alt=''
              fill
              className='object-cover'
              referrerPolicy='no-referrer'
            />
          </button>
        ))}
      </div>

      {/* 圆点切换（移动端） */}
      <div className='absolute bottom-4 right-4 z-10 flex gap-1.5 md:hidden'>
        {items.map((item, i) => (
          <button
            key={item.id}
            type='button'
            onClick={() => goTo(i)}
            aria-label={item.title}
            className={`h-1.5 rounded-full transition-all ${
              i === index % count ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
