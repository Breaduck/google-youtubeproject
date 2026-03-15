import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { styleTemplates } from '../src/data/styleTemplates.js';

const VERTEX_AI_ENDPOINT = 'https://us-central1-aiplatform.googleapis.com';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
const MODEL = 'imagen-4.0-generate-001';
const COST_PER_IMAGE = 0.02; // USD

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getAccessToken(): Promise<string> {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  return token;
}

async function generateImage(prompt: string, retries = 3): Promise<Buffer | null> {
  const token = await getAccessToken();
  const url = `${VERTEX_AI_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${MODEL}:predict`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9',
            safetySetting: 'block_some',
            personGeneration: 'allow_adult',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: any = await response.json();
      const base64Image = data.predictions[0].bytesBase64Encoded;
      return Buffer.from(base64Image, 'base64');
    } catch (error) {
      console.error(`  ❌ Attempt ${attempt}/${retries} failed`);
      if (attempt < retries) await sleep(2000);
    }
  }
  return null;
}

async function main() {
  console.log('🎨 스타일 템플릿 썸네일 생성 시작\n');

  if (!PROJECT_ID) {
    console.error('❌ GOOGLE_CLOUD_PROJECT_ID 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

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

    const imageBuffer = await generateImage(prompt);

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
