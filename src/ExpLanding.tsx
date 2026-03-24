import { useState } from 'react';
import App from './App.tsx';

export default function ExpLanding() {
  const [started, setStarted] = useState(false);

  if (started) return <App />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', fontFamily: 'sans-serif', gap: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>소금 장인의 숨겨진 진실</h1>
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '20px 32px', fontSize: 18, maxWidth: 460, textAlign: 'center', lineHeight: 1.7 }}>
        "아버님! 그건 아버님이 만든 소금이 아니잖아요!"
      </div>
      <button
        onClick={() => setStarted(true)}
        style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 14, padding: '16px 42px', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
      >
        스토리보드로 이동
      </button>
    </div>
  );
}
