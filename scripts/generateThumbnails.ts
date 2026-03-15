import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { styleTemplates } from '../src/data/styleTemplates.js';

// .env.local 파일 로드
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const COST_PER_IMAGE = 0.02;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 각 스타일별 맞춤 프롬프트 (정면 인물 중심)
const STYLE_PROMPTS: Record<string, string> = {
  // 애니메이션
  'cyberpunk-anime': 'Close-up portrait of a cyberpunk hacker girl, neon purple hair, glowing circuit tattoos on face, intense eye contact with viewer, vibrant anime style, sharp cel-shading, holographic UI reflections in eyes, facing camera, urban neon background',
  'korean-webtoon': 'Korean webtoon style portrait of a young office worker, clean modern lines, soft colors, expressive large eyes, gentle smile, facing viewer, simple gradient background, manhwa digital art style',
  'comedy-webtoon': 'Comedic webtoon portrait of a goofy character making exaggerated surprised expression, big round eyes, dynamic hair, vibrant colors, chibi proportions, facing camera, speed lines background',
  'superhero-action': 'Dynamic superhero portrait in action pose, cape flowing, determined expression, bold comic book style, strong shadows, halftone dots, facing 3/4 angle toward viewer, city skyline background',
  'romance-webtoon': 'Romantic shoujo manga portrait of a gentle young woman, sparkling eyes, soft pastel colors, delicate linework, cherry blossoms around face, dreamy expression, facing viewer, bokeh background',
  'modern-anime': 'High-quality anime portrait of a cool protagonist, detailed hair strands, sharp eyes, modern casual outfit, studio-quality cel-shading, subtle rim lighting, confident gaze at viewer, 3/4 angle',
  'martial-fantasy': 'Epic martial arts warrior portrait, flowing traditional robes, intense focused eyes, dynamic pose mid-movement, Chinese manhwa style, dramatic lighting, energy aura visible, facing camera',
  'historical-comedy': 'Humorous historical Korean drama portrait, traditional hanbok, funny exaggerated expression, warm colors, soft brush strokes, facing viewer with playful smile, palace background',
  'thriller-webtoon': 'Tense thriller webtoon portrait, mysterious person in shadows, partially lit face, sharp contrasts, cold color palette, suspicious gaze toward viewer, noir atmosphere',
  'rural-history': 'Nostalgic portrait of a countryside elder, warm earthy tones, gentle wrinkles showing wisdom, traditional Korean clothing, soft natural lighting, kind eyes facing viewer, rural landscape background',
  'korean-history-illust': 'Historical Korean illustration portrait, elegant scholar in traditional gat hat, refined brush strokes, muted traditional colors, dignified pose, facing 3/4 angle, minimalist background',

  // 실사
  'cinematic-drama': 'Photorealistic close-up portrait of a 30-year-old actress, cinematic lighting, 85mm lens, shallow depth of field, natural skin texture with visible pores, emotional eyes looking at camera, film grain, color graded like a movie still',
  'documentary': 'Documentary-style portrait photograph of a local artisan at work, natural lighting, 50mm lens, authentic expression, environmental portrait showing workspace, DSLR quality, photojournalistic style, direct eye contact',
  'vlog': 'Casual vlog selfie portrait, bright natural window lighting, friendly smile directly at camera, smartphone camera aesthetic, warm welcoming expression, clean modern background, authentic and relatable',
  'music-video': 'Artistic music video portrait, dramatic colored gel lighting, singer facing camera with intense expression, creative shadows, 35mm film look, vibrant color grading, dynamic angle',
  'news-report': 'Professional news reporter portrait, studio lighting setup, formal attire, confident expression facing camera, clean background, broadcast quality, sharp focus on face, neutral color balance',

  // 장르성 캐릭터
  'scifi-space': 'Sci-fi astronaut portrait, futuristic helmet visor reflecting stars, detailed spacesuit, glowing HUD elements, determined eyes visible through glass, facing viewer, space station interior background',
  'fantasy-rpg': 'Fantasy RPG character portrait, detailed medieval armor with glowing runes, battle-worn face with scars, intense warrior eyes, holding legendary sword, facing 3/4 angle, mystical background',
  'zombie-apocalypse': 'Post-apocalyptic survivor portrait, dirty face, weathered clothing, determined survival expression, weapon visible, gritty realistic style, facing camera with cautious look, ruined city background',
  'noir-detective': 'Film noir detective portrait, fedora hat casting shadow, cigarette smoke, high contrast black and white, mysterious expression, trench coat, facing camera in moody lighting, rain-streaked window background',
  'steampunk': 'Steampunk inventor portrait, brass goggles on forehead, Victorian clothing with gears, intelligent focused expression, mechanical arm visible, facing viewer, workshop with steam background',

  // 일러스트
  'watercolor': 'Watercolor portrait painting of a serene young person, soft flowing brush strokes, pastel pink and blue tones, gentle expression, loose artistic style, facing viewer, visible paper texture, dreamy atmosphere',
  'storybook': 'Children\'s storybook illustration portrait, whimsical friendly character, big expressive eyes, warm cheerful smile, simple shapes with outlines, bright primary colors, facing camera, magical sparkles around',
  'minimal-flat': 'Minimal flat design portrait, simple geometric shapes, solid bold colors, clean vector style, smiling face with basic features, facing viewer straight on, single color background, modern digital art',
  'pop-art': 'Pop art portrait in Warhol style, bold contrasting colors, halftone dot pattern, graphic bold outlines, vibrant expression, facing camera, repeated color variations, retro 60s aesthetic',
  'pencil-sketch': 'Detailed pencil sketch portrait, realistic graphite shading, cross-hatching technique, expressive eyes, gentle smile, facing 3/4 angle, visible sketch lines, white paper texture',

  // 전통화
  'korean-ink': 'Traditional Korean ink wash painting portrait, minimal elegant brush strokes, black ink on rice paper, serene meditation pose, simple facial features, facing viewer, misty mountain background',
  'ukiyoe': 'Japanese ukiyo-e woodblock print portrait, geisha with elaborate hairstyle, flat vivid colors, bold black outlines, graceful expression, facing 3/4 angle, cherry blossom pattern background',
  'chinese-landscape': 'Chinese traditional painting portrait of a wise scholar, delicate brush work, muted earth tones, flowing robes, contemplative expression, facing viewer, mountain mist background',
  'western-oil': 'Classical oil painting portrait, Renaissance style, rich impasto texture, warm dramatic lighting, noble subject in period clothing, facing 3/4 angle like Rembrandt, dark background',
  'minhwa': 'Korean folk minhwa painting portrait, bright cheerful colors, naive charming style, decorative patterns, smiling traditional figure, facing viewer, auspicious symbols around, flat perspective'
};

async function generateImage(genai: GoogleGenAI, prompt: string, retries = 3): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await genai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config: {
          responseModalities: ['image', 'text']
        }
      });

      if (result.candidates && result.candidates[0]?.content?.parts) {
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return Buffer.from(part.inlineData.data, 'base64');
          }
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Attempt ${attempt}/${retries}: ${error.message}`);
      if (attempt < retries) await sleep(2000);
    }
  }
  return null;
}

async function main() {
  console.log('🎨 스타일 템플릿 썸네일 생성 시작 (Gemini 2.5 Flash Image)\n');

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    console.error('.env.local 파일에 API 키를 입력하세요.');
    process.exit(1);
  }

  const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const outputDir = path.join(process.cwd(), 'public', 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const totalTemplates = styleTemplates.length;
  let successCount = 0;

  for (let i = 0; i < styleTemplates.length; i++) {
    const template = styleTemplates[i];
    console.log(`\n[${i + 1}/${totalTemplates}] ${template.name} (${template.category})`);

    const customPrompt = STYLE_PROMPTS[template.id];
    if (!customPrompt) {
      console.log(`  ⚠️  맞춤 프롬프트 없음, 기본 프롬프트 사용`);
    }

    const finalPrompt = customPrompt || `${template.imagePromptPrefix}, portrait of a person facing camera, 16:9 aspect ratio`;

    const imageBuffer = await generateImage(genai, finalPrompt);

    if (imageBuffer) {
      const outputPath = path.join(outputDir, `${template.id}.webp`);
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`  ✅ 저장: ${template.id}.webp`);
      successCount++;
    } else {
      console.log(`  ❌ 실패`);
    }

    if (i < styleTemplates.length - 1) await sleep(1000);
  }

  console.log('\n\n📊 결과');
  console.log(`✅ 성공: ${successCount}/${totalTemplates}`);
  console.log(`💰 비용: $${(successCount * COST_PER_IMAGE).toFixed(2)} (약 ₩${Math.round(successCount * COST_PER_IMAGE * 1460)})`);
  console.log('\n✨ 완료!');
}

main().catch(console.error);
