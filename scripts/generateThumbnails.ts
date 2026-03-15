import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { styleTemplates } from '../src/data/styleTemplates.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const COST_PER_IMAGE = 0.04; // Imagen 3 Fast

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateImage(genai: GoogleGenAI, prompt: string, retries = 3): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await genai.models.generateImages({
        model: 'imagen-3.0-generate-001',
        prompt: prompt,
        number: 1,
        aspectRatio: '16:9',
        safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }],
      });

      if (result.images && result.images.length > 0) {
        const base64Image = result.images[0].image.imageBytes;
        return Buffer.from(base64Image, 'base64');
      }
    } catch (error: any) {
      console.error(`  ❌ Attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) await sleep(2000);
    }
  }
  return null;
}

async function main() {
  console.log('🎨 스타일 템플릿 썸네일 생성 시작\n');

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    console.error('설정 방법: export GEMINI_API_KEY=your_api_key');
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
    console.log(`\n[${i + 1}/${totalTemplates}] ${template.name}`);

    const prompt = `${template.imagePromptPrefix}, cinematic wide shot, a young warrior standing on a cliff overlooking a vast landscape, dramatic lighting, high quality, detailed background, 16:9 aspect ratio`;

    const imageBuffer = await generateImage(genai, prompt);

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
