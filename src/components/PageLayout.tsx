import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import TopNav from './TopNav';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  /** 首页 Hero 铺在顶栏下方时，顶栏未滚动保持透明 */
  transparentTop?: boolean;
}

const PageLayout = ({
  children,
  activePath = '/',
  transparentTop = false,
}: PageLayoutProps) => {
  return (
    <div className='relative w-full min-h-screen'>
      {/* 移动端头部 */}
      <MobileHeader
        showBackButton={['/play'].includes(activePath)}
        transparentAtTop={transparentTop}
      />

      {/* 桌面端顶部导航 */}
      <TopNav transparentAtTop={transparentTop} />

      {/* 主内容区域 */}
      <div className='relative min-w-0 flex-1'>
        {/* 桌面端左上角返回按钮 */}
        {['/play'].includes(activePath) && (
          <div className='absolute top-3 left-1 z-20 hidden md:flex'>
            <BackButton />
          </div>
        )}

        {/* 主内容 */}
        <main
          className='flex-1 md:min-h-0 mb-14 md:mb-0'
          style={{
            paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </main>
      </div>

      {/* 移动端底部导航 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
