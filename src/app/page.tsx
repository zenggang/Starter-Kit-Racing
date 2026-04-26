import Link from 'next/link';
import { getPublicRuntimeMode } from '@/config/env';

export default function HomePage() {
  const mode = getPublicRuntimeMode();

  return (
    <main className="app-shell">
      <section className="race-home">
        <div className="race-home-copy">
          <p className="eyebrow">在线赛车</p>
          <h1>发车大厅</h1>
          <p className="muted">手机优先的在线赛车房间，选车、准备、发车，一屏完成。</p>
        </div>

        {mode === 'demo' ? (
          <div className="race-panel stack">
            <span className="status-pill">本地演示</span>
            <h2>联机环境未启用</h2>
            <p className="muted">当前缺少 Supabase 公开环境变量，可以先进入本地赛道试玩。</p>
            <Link href="/race/demo">
              <button type="button">进入本地赛道</button>
            </Link>
          </div>
        ) : (
          <div className="race-panel race-panel-home stack">
            <span className="status-pill">在线模式</span>
            <h2>进入维修区</h2>
            <p className="muted">创建房间或输入房间码，等车手集结后再发车。</p>
            <Link href="/hall">
              <button type="button" className="primary-action">
                进入大厅
              </button>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
