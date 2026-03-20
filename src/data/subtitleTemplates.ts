import { SubtitleTemplate, DEFAULT_SUBTITLE_STYLE } from '../types/subtitle';

export const PRESET_TEMPLATES: SubtitleTemplate[] = [
  // 기본 카테고리
  {
    id: 'basic-white',
    name: '기본 (흰색)',
    category: 'basic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FFFFFF',
      stroke: { enabled: true, color: '#000000', width: 2 },
    },
  },
  {
    id: 'semi-black',
    name: '반투명 검정',
    category: 'basic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FFFFFF',
      background: { enabled: true, color: '#000000', opacity: 0.7, borderRadius: 8, padding: 12 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'yellow-subtitle',
    name: '노란 자막',
    category: 'basic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FFD700',
      stroke: { enabled: true, color: '#000000', width: 3 },
    },
  },
  {
    id: 'green-subtitle',
    name: '녹색 그림',
    category: 'basic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#32CD32',
      stroke: { enabled: true, color: '#000000', width: 2 },
    },
  },

  // 컬러 카테고리
  {
    id: 'sky-blue',
    name: '스카이 블루',
    category: 'color',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#87CEEB',
      stroke: { enabled: true, color: '#00008B', width: 3 },
    },
  },
  {
    id: 'lime',
    name: '라임',
    category: 'color',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#32CD32',
      stroke: { enabled: true, color: '#006400', width: 2 },
    },
  },
  {
    id: 'pink-pop',
    name: '핑크 팝',
    category: 'color',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FF69B4',
      stroke: { enabled: true, color: '#8B008B', width: 3 },
    },
  },
  {
    id: 'coral-pink',
    name: '코랄 핑크',
    category: 'color',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FF7F7F',
      stroke: { enabled: true, color: '#8B0000', width: 2 },
    },
  },
  {
    id: 'dark-red',
    name: '다크 레드',
    category: 'color',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#8B0000',
      background: { enabled: true, color: '#000000', opacity: 0.9, borderRadius: 6, padding: 10 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },

  // 스타일 카테고리
  {
    id: 'youtube-shorts',
    name: '유튜브 쇼츠',
    category: 'style',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Pretendard',
      fontSize: 64,
      color: '#FFFFFF',
      background: { enabled: true, color: '#FFD700', opacity: 0.9, borderRadius: 12, padding: 16 },
      stroke: { enabled: true, color: '#000000', width: 4 },
    },
  },
  {
    id: 'youtube-style',
    name: '유튜브 스타일',
    category: 'style',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FFFFFF',
      background: { enabled: true, color: '#FF0000', opacity: 0.95, borderRadius: 4, padding: 8 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'netflix-black',
    name: '넷플릭스 블랙',
    category: 'style',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Noto Sans KR',
      color: '#FFFFFF',
      background: { enabled: true, color: '#000000', opacity: 0.85, borderRadius: 4, padding: 10 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'netflix-style',
    name: '넷플릭스 스타일',
    category: 'style',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Noto Sans KR',
      color: '#E50914',
      stroke: { enabled: true, color: '#FFFFFF', width: 2 },
    },
  },
  {
    id: 'blog-style',
    name: '블로그 스타일',
    category: 'style',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#000000',
      background: { enabled: true, color: '#FFFFFF', opacity: 0.95, borderRadius: 12, padding: 14 },
      shadow: { enabled: true, color: '#00000040', x: 2, y: 2, blur: 8 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'asmr-style',
    name: 'ASMR 스타일',
    category: 'style',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 36,
      color: '#FFFFFF',
      shadow: { enabled: true, color: '#00000030', x: 1, y: 1, blur: 3 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },

  // 예능/버라이어티
  {
    id: 'breaking-news',
    name: '뉴스 속보',
    category: 'variety',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Noto Sans KR',
      fontSize: 58,
      color: '#FFFFFF',
      background: { enabled: true, color: '#FF0000', opacity: 1.0, borderRadius: 0, padding: 12 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'red-emphasis',
    name: '빨간색 강조',
    category: 'variety',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 62,
      color: '#FF0000',
      stroke: { enabled: true, color: '#FFFFFF', width: 4 },
    },
  },
  {
    id: 'music-video',
    name: '뮤직비디오',
    category: 'variety',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Nanum Gothic',
      fontSize: 52,
      color: '#FFFFFF',
      stroke: { enabled: true, color: '#FF00FF', width: 3 },
      position: { x: 50, y: 50, preset: 'center' },
    },
  },
  {
    id: 'popping-black',
    name: '팝핑 블랙',
    category: 'variety',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 60,
      color: '#000000',
      stroke: { enabled: true, color: '#FFD700', width: 5 },
    },
  },

  // 감성/시네마
  {
    id: 'movie-subtitle',
    name: '영화 자막',
    category: 'cinematic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Noto Sans KR',
      fontSize: 48,
      color: '#FFFFFF',
      stroke: { enabled: true, color: '#000000', width: 1 },
      position: { x: 50, y: 90, preset: 'bottom-center' },
    },
  },
  {
    id: 'dramatic',
    name: '드라마틱',
    category: 'cinematic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Noto Sans KR',
      fontSize: 56,
      color: '#FFFFFF',
      shadow: { enabled: true, color: '#000000', x: 4, y: 4, blur: 8 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'documentary',
    name: '다큐멘터리',
    category: 'cinematic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Noto Sans KR',
      fontSize: 44,
      color: '#FFFFFF',
      background: { enabled: true, color: '#000000', opacity: 0.5, borderRadius: 0, padding: 8 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'insta-story',
    name: '인스타 스토리',
    category: 'cinematic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Pretendard',
      fontSize: 58,
      color: '#FFFFFF',
      background: { enabled: true, color: '#FF00FF', opacity: 0.7, borderRadius: 16, padding: 14 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'soft-white',
    name: '소프트 화이트',
    category: 'cinematic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 50,
      color: '#F5F5F5',
      shadow: { enabled: true, color: '#00000050', x: 2, y: 2, blur: 6 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'bold-white',
    name: '볼드 화이트',
    category: 'cinematic',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 66,
      color: '#FFFFFF',
      stroke: { enabled: true, color: '#000000', width: 6 },
    },
  },

  // 프리미엄
  {
    id: 'gold-premium',
    name: '골드 프리미엄',
    category: 'premium',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 60,
      color: '#FFD700',
      stroke: { enabled: true, color: '#8B4513', width: 3 },
      shadow: { enabled: true, color: '#00000080', x: 3, y: 3, blur: 6 },
    },
  },
  {
    id: 'silver-premium',
    name: '실버 프리미엄',
    category: 'premium',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 58,
      color: '#C0C0C0',
      shadow: { enabled: true, color: '#FFFFFF80', x: 0, y: 0, blur: 10 },
      stroke: { enabled: true, color: '#000000', width: 2 },
    },
  },
  {
    id: 'rose-premium',
    name: '로즈 프리미엄',
    category: 'premium',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 56,
      color: '#B76E79',
      stroke: { enabled: true, color: '#8B4513', width: 2 },
      shadow: { enabled: true, color: '#00000060', x: 2, y: 2, blur: 5 },
    },
  },
  {
    id: 'ice-premium',
    name: '아이스 프리미엄',
    category: 'premium',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 54,
      color: '#E0FFFF',
      shadow: { enabled: true, color: '#FFFFFF90', x: 0, y: 0, blur: 12 },
      stroke: { enabled: true, color: '#4682B4', width: 2 },
    },
  },
  {
    id: 'silver-outline',
    name: '실버 아웃라인',
    category: 'premium',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 58,
      color: '#FFFFFF',
      stroke: { enabled: true, color: '#C0C0C0', width: 4 },
    },
  },

  // 배경없음
  {
    id: 'white-on-red',
    name: '화이트 온 레드',
    category: 'no-bg',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FFFFFF',
      stroke: { enabled: true, color: '#FF0000', width: 4 },
      background: { enabled: false, color: '#000000', opacity: 0, borderRadius: 0, padding: 0 },
    },
  },
  {
    id: 'red-outline',
    name: '레드 아웃라인',
    category: 'no-bg',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FF0000',
      stroke: { enabled: true, color: '#FFFFFF', width: 3 },
      background: { enabled: false, color: '#000000', opacity: 0, borderRadius: 0, padding: 0 },
    },
  },
  {
    id: 'glass-dark',
    name: '글래스 다크',
    category: 'no-bg',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FFFFFF',
      background: { enabled: true, color: '#00000060', opacity: 0.4, borderRadius: 12, padding: 10 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'white-bg-black-text',
    name: '흰 배경 검정 글씨',
    category: 'no-bg',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#000000',
      background: { enabled: true, color: '#FFFFFF', opacity: 1.0, borderRadius: 8, padding: 12 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
  {
    id: 'red-emphasis-black',
    name: '빨간 강조 블랙',
    category: 'no-bg',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      color: '#FF0000',
      background: { enabled: true, color: '#000000', opacity: 0.9, borderRadius: 6, padding: 10 },
      stroke: { enabled: false, color: '#000000', width: 0 },
    },
  },
];

export const FONT_OPTIONS = [
  { value: 'Pretendard', label: 'Pretendard (기본)' },
  { value: 'Noto Sans KR', label: 'Noto Sans KR' },
  { value: 'Nanum Gothic', label: '나눔고딕' },
  { value: 'Nanum Myeongjo', label: '나눔명조' },
  { value: 'Baemin Jua', label: '배민 주아체' },
  { value: 'MaruBuri', label: '마루부리' },
  { value: 'EsamanruLight', label: '이사만루체' },
  { value: 'Cafe24Ssurround', label: 'Cafe24 써라운드' },
  { value: 'Cafe24Dangdanghae', label: 'Cafe24 당당해' },
  { value: 'DungGeunMo', label: '둥근모꼴' },
  { value: 'GowunBatang', label: '고운바탕' },
  { value: 'Sweet Sans', label: '스위트' },
  { value: 'SUIT', label: '수트' },
  { value: 'RIDIBatang', label: '리디바탕' },
];

export const CATEGORY_OPTIONS = [
  { value: 'all', label: '전체', icon: '📂' },
  { value: 'favorite', label: '즐겨찾기', icon: '⭐' },
  { value: 'basic', label: '기본', icon: '📄' },
  { value: 'color', label: '컬러', icon: '🎨' },
  { value: 'style', label: '스타일', icon: '✨' },
  { value: 'variety', label: '예능/버라이어티', icon: '🎬' },
  { value: 'cinematic', label: '감성/시네마', icon: '🎥' },
  { value: 'premium', label: '프리미엄', icon: '💎' },
  { value: 'no-bg', label: '배경없음', icon: '🔲' },
  { value: 'custom', label: '내 템플릿', icon: '💾' },
];
