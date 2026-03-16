import { StyleTemplate } from '../types/template';

export const styleTemplates: StyleTemplate[] = [
  // 애니메이션
  { id: 'cyberpunk-anime', category: '애니메이션', name: '사이버펑크 애니메이션', thumbnail: '/templates/cyberpunk-anime.webp', imagePromptPrefix: 'Cyberpunk anime style, neon colors, futuristic cityscape,', negativePrompt: 'realistic, photographic, 3d render' },
  { id: 'korean-webtoon', category: '애니메이션', name: '한국 웹툰/만화', thumbnail: '/templates/korean-webtoon.webp', imagePromptPrefix: 'Korean webtoon style, clean lines, vibrant colors,', negativePrompt: 'realistic, photo, sketch' },
  { id: 'comedy-webtoon', category: '애니메이션', name: '영상/코미디 웹툰', thumbnail: '/templates/comedy-webtoon.webp', imagePromptPrefix: 'Comedy webtoon style, exaggerated expressions, dynamic poses,', negativePrompt: 'serious, dark, realistic' },
  { id: 'superhero-action', category: '애니메이션', name: '슈퍼히어로 액션', thumbnail: '/templates/superhero-action.webp', imagePromptPrefix: 'Superhero action style, bold colors, dynamic motion,', negativePrompt: 'realistic, still, static' },
  { id: 'romance-webtoon', category: '애니메이션', name: '로맨스/순정 웹툰', thumbnail: '/templates/romance-webtoon.webp', imagePromptPrefix: 'Romance webtoon style, soft colors, gentle lighting,', negativePrompt: 'dark, action, violent' },
  { id: 'modern-anime', category: '애니메이션', name: '템플릿', thumbnail: '/templates/modern-anime.webp', imagePromptPrefix: 'Modern anime style, detailed backgrounds, cel-shaded,', negativePrompt: 'realistic, 3d, photo' },
  { id: 'martial-fantasy', category: '애니메이션', name: '무협/판타지 웹툰', thumbnail: '/templates/martial-fantasy.webp', imagePromptPrefix: 'Martial arts fantasy webtoon, dramatic lighting, epic scenes,', negativePrompt: 'modern, realistic, cute' },
  { id: 'historical-comedy', category: '애니메이션', name: '사극 코미디 웹툰', thumbnail: '/templates/historical-comedy.webp', imagePromptPrefix: 'Historical comedy webtoon, traditional Korean setting,', negativePrompt: 'modern, serious, realistic' },
  { id: 'thriller-webtoon', category: '애니메이션', name: '스릴러/공포 웹툰', thumbnail: '/templates/thriller-webtoon.webp', imagePromptPrefix: 'Thriller horror webtoon, dark atmosphere, suspenseful,', negativePrompt: 'bright, cheerful, cute' },
  { id: 'rural-history', category: '애니메이션', name: '역사 시골 웹툰', thumbnail: '/templates/rural-history.webp', imagePromptPrefix: 'Historical rural webtoon, traditional village, nostalgic,', negativePrompt: 'modern, urban, futuristic' },
  { id: 'korean-history-illust', category: '애니메이션', name: '한국 역사 일러스트', thumbnail: '/templates/korean-history-illust.webp', imagePromptPrefix: 'Korean historical illustration, traditional clothing,', negativePrompt: 'modern, western, realistic photo' },

  // 실사
  { id: 'cinematic-drama', category: '실사', name: '시네마틱 드라마', thumbnail: '/templates/cinematic-drama.webp', imagePromptPrefix: 'Cinematic drama style, film grain, professional lighting,', negativePrompt: 'cartoon, anime, illustration' },
  { id: 'documentary', category: '실사', name: '다큐멘터리', thumbnail: '/templates/documentary.webp', imagePromptPrefix: 'Documentary style, natural lighting, authentic,', negativePrompt: 'staged, artificial, cartoon' },
  { id: 'vlog', category: '실사', name: '브이로그', thumbnail: '/templates/vlog.webp', imagePromptPrefix: 'Vlog style, casual setting, personal perspective,', negativePrompt: 'professional, studio, cartoon' },
  { id: 'music-video', category: '실사', name: '뮤직비디오', thumbnail: '/templates/music-video.webp', imagePromptPrefix: 'Music video style, artistic shots, creative lighting,', negativePrompt: 'documentary, plain, cartoon' },
  { id: 'news-report', category: '실사', name: '뉴스/리포트', thumbnail: '/templates/news-report.webp', imagePromptPrefix: 'News report style, professional setting, clear composition,', negativePrompt: 'artistic, stylized, cartoon' },

  // 장르성 캐릭터
  { id: 'scifi-space', category: '장르성 캐릭터', name: 'SF/우주', thumbnail: '/templates/scifi-space.webp', imagePromptPrefix: 'Sci-fi space style, futuristic technology, cosmic background,', negativePrompt: 'historical, medieval, realistic photo' },
  { id: 'fantasy-rpg', category: '장르성 캐릭터', name: '판타지 RPG', thumbnail: '/templates/fantasy-rpg.webp', imagePromptPrefix: 'Fantasy RPG style, medieval armor, magical effects,', negativePrompt: 'modern, realistic, scifi' },
  { id: 'zombie-apocalypse', category: '장르성 캐릭터', name: '좀비/포스트아포칼립스', thumbnail: '/templates/zombie-apocalypse.webp', imagePromptPrefix: 'Post-apocalyptic style, ruined cityscape, survival atmosphere,', negativePrompt: 'clean, bright, cheerful' },
  { id: 'noir-detective', category: '장르성 캐릭터', name: '누아르/탐정', thumbnail: '/templates/noir-detective.webp', imagePromptPrefix: 'Film noir detective style, high contrast, shadows,', negativePrompt: 'bright, colorful, cartoon' },
  { id: 'steampunk', category: '장르성 캐릭터', name: '스팀펑크', thumbnail: '/templates/steampunk.webp', imagePromptPrefix: 'Steampunk style, Victorian era, brass and gears,', negativePrompt: 'modern, digital, minimalist' },

  // 일러스트
  { id: 'watercolor', category: '일러스트', name: '수채화', thumbnail: '/templates/watercolor.webp', imagePromptPrefix: 'Watercolor illustration, soft edges, pastel colors,', negativePrompt: 'digital, sharp, photo' },
  { id: 'storybook', category: '일러스트', name: '동화/그림책', thumbnail: '/templates/storybook.webp', imagePromptPrefix: 'Children storybook illustration, whimsical, colorful,', negativePrompt: 'realistic, dark, adult' },
  { id: 'minimal-flat', category: '일러스트', name: '미니멀 플랫', thumbnail: '/templates/minimal-flat.webp', imagePromptPrefix: 'Minimal flat design, simple shapes, solid colors,', negativePrompt: 'detailed, realistic, textured' },
  { id: 'pop-art', category: '일러스트', name: '팝아트', thumbnail: '/templates/pop-art.webp', imagePromptPrefix: 'Pop art style, bold colors, halftone dots,', negativePrompt: 'realistic, muted, traditional' },
  { id: 'pencil-sketch', category: '일러스트', name: '연필 스케치', thumbnail: '/templates/pencil-sketch.webp', imagePromptPrefix: 'Pencil sketch style, hand-drawn lines, grayscale,', negativePrompt: 'color, digital, polished' },

  // 전통화
  { id: 'korean-ink', category: '전통화', name: '한국 수묵화', thumbnail: '/templates/korean-ink.webp', imagePromptPrefix: 'Korean ink wash painting, brush strokes, minimalist,', negativePrompt: 'colorful, digital, western' },
  { id: 'ukiyoe', category: '전통화', name: '일본 우키요에', thumbnail: '/templates/ukiyoe.webp', imagePromptPrefix: 'Japanese ukiyo-e woodblock print, flat colors,', negativePrompt: 'realistic, photo, modern' },
  { id: 'chinese-landscape', category: '전통화', name: '중국 산수화', thumbnail: '/templates/chinese-landscape.webp', imagePromptPrefix: 'Chinese landscape painting, mountains and water,', negativePrompt: 'modern, urban, digital' },
  { id: 'western-oil', category: '전통화', name: '서양 유화', thumbnail: '/templates/western-oil.webp', imagePromptPrefix: 'Western oil painting style, thick brushstrokes,', negativePrompt: 'digital, flat, minimalist' },
  { id: 'minhwa', category: '전통화', name: '민화', thumbnail: '/templates/minhwa.webp', imagePromptPrefix: 'Korean folk painting minhwa, bright colors, symbolic,', negativePrompt: 'realistic, dark, modern' },
];

export const templateCategories = ['실사', '장르성 캐릭터', '일러스트', '애니메이션', '전통화'] as const;
