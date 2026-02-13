import { useState } from 'react';
import App from './App.tsx';

export default function ExpLanding() {
  const [started, setStarted] = useState(false);

  if (started) return <App />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', fontFamily: 'sans-serif', gap: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>소금 장인의 숨겨진 진실</h1>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: '24px 36px', fontSize: 20, maxWidth: 480, textAlign: 'center', lineHeight: 1.8 }}>
        "아버님! 그건 아버님이 만든 소금이 아니잖아요!"
      </div>
      <button
        onClick={() => setStarted(true)}
        style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 16, padding: '18px 48px', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}
      >
        스토리보드로 이동
      </button>
    </div>
  );
}
