/* eslint-disable no-console */
'use client';

import { X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  deletePlayRecord,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { processImageUrl } from '@/lib/utils';

import ScrollableRow from '@/components/ScrollableRow';

interface ContinueWatchingProps {
  className?: string;
}

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const router = useRouter();
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    // 将记录转换为数组并根据 save_time 由近到远排序
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    // 按 save_time 降序排序（最新的在前面）
    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time
    );

    setPlayRecords(sortedRecords);
  };

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);

        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, []);

  // 如果没有播放记录，则不渲染组件
  if (!loading && playRecords.length === 0) {
    return null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  const handlePlay = (record: PlayRecord & { key: string }) => {
    const { source, id } = parseKey(record.key);
    router.push(
      `/play?source=${source}&id=${id}&title=${encodeURIComponent(
        record.title
      )}${record.year ? `&year=${record.year}` : ''}${
        record.search_title
          ? `&stitle=${encodeURIComponent(record.search_title.trim())}`
          : ''
      }${record.total_episodes > 1 ? '&stype=tv' : ''}`
    );
  };

  const handleDelete = async (
    e: React.MouseEvent,
    record: PlayRecord & { key: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const { source, id } = parseKey(record.key);
    try {
      await deletePlayRecord(source, id);
      setPlayRecords((prev) => prev.filter((r) => r.key !== record.key));
    } catch (error) {
      console.error('删除播放记录失败:', error);
    }
  };

  return (
    <section className={`mb-8 ${className || ''}`}>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          继续观看
        </h2>
        {!loading && playRecords.length > 0 && (
          <button
            className='text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400'
            onClick={async () => {
              await clearAllPlayRecords();
              setPlayRecords([]);
            }}
          >
            清空
          </button>
        )}
      </div>
      <ScrollableRow>
        {loading
          ? // 加载状态显示灰色占位数据
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className='flex w-[280px] shrink-0 gap-3 sm:w-[320px]'
              >
                <div className='relative aspect-[2/3] w-[84px] shrink-0 overflow-hidden rounded-lg bg-gray-200 animate-pulse sm:w-[104px] dark:bg-gray-800' />
                <div className='min-w-0 flex-1 py-1'>
                  <div className='h-4 w-3/4 rounded bg-gray-200 animate-pulse dark:bg-gray-800' />
                  <div className='mt-2 h-3 w-1/2 rounded bg-gray-200 animate-pulse dark:bg-gray-800' />
                  <div className='mt-6 h-1 w-full rounded-full bg-gray-200 animate-pulse dark:bg-gray-800' />
                </div>
              </div>
            ))
          : // 显示真实数据：IceTV 式横向卡片（海报左 + 进度右）
            playRecords.map((record) => {
              const progress = getProgress(record);
              return (
                <div
                  key={record.key}
                  className='group relative flex w-[280px] shrink-0 cursor-pointer gap-3 sm:w-[320px]'
                  onClick={() => handlePlay(record)}
                >
                  {/* 海报 */}
                  <div className='relative aspect-[2/3] w-[84px] shrink-0 overflow-hidden rounded-lg sm:w-[104px]'>
                    <Image
                      src={processImageUrl(record.cover)}
                      alt={record.title}
                      fill
                      className='object-cover transition-transform duration-300 group-hover:scale-105'
                      referrerPolicy='no-referrer'
                    />
                  </div>
                  {/* 文案 + 进度 */}
                  <div className='flex min-w-0 flex-1 flex-col py-0.5'>
                    <div className='line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-brand-600 dark:text-gray-100 dark:group-hover:text-brand-400'>
                      {record.title}
                    </div>
                    <div className='mt-1 truncate text-[13px] text-gray-500 dark:text-gray-400'>
                      {record.total_episodes > 1
                        ? `第 ${record.index} 集 / 共 ${record.total_episodes} 集`
                        : record.source_name}
                      {record.total_episodes > 1 &&
                        record.source_name &&
                        ` · ${record.source_name}`}
                    </div>
                    <div className='mt-auto'>
                      <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                        <span>看到 {formatTime(record.play_time)}</span>
                        <span className='font-semibold text-gray-700 dark:text-gray-300'>
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className='mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
                        <div
                          className='h-full rounded-full bg-brand-500 transition-all duration-500'
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {/* 删除 */}
                  <button
                    type='button'
                    aria-label='删除记录'
                    onClick={(e) => handleDelete(e, record)}
                    className='absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </div>
              );
            })}
      </ScrollableRow>
    </section>
  );
}
