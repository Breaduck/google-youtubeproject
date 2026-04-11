/**
 * Cloudflare Worker: BytePlus Video Proxy
 * Modal 대체용 - 완전 무료 (10만 요청/일)
 */

interface Env {
  IMGUR_CLIENT_ID: string;
}

const BYTEPLUS_API_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS 헤더
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Imgur 업로드
      if (url.pathname === '/api/v3/uploads' && request.method === 'POST') {
        const body = await request.json() as any;
        const base64Data = body.image.includes(',') ? body.image.split(',')[1] : body.image;

        const imgurRes = await fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            'Authorization': `Client-ID ${env.IMGUR_CLIENT_ID}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64Data, type: 'base64' }),
        });

        if (!imgurRes.ok) {
          throw new Error(`Imgur upload failed: ${imgurRes.status}`);
        }

        const result = await imgurRes.json() as any;
        return new Response(JSON.stringify({ image_url: result.data.link }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. BytePlus 태스크 생성
      if (url.pathname === '/api/v3/content_generation/tasks' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return new Response('Authorization required', { status: 401, headers: corsHeaders });
        }

        const body = await request.json() as any;
        const byteplusRes = await fetch(`${BYTEPLUS_API_BASE}/contents/generations/tasks`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: body.model || 'seedance-1-0-pro-fast-251015',
            content: body.content,
          }),
        });

        const result = await byteplusRes.text();
        return new Response(result, {
          status: byteplusRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. BytePlus 태스크 조회
      if (url.pathname.startsWith('/api/v3/content_generation/tasks/') && request.method === 'GET') {
        const taskId = url.pathname.split('/').pop();
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return new Response('Authorization required', { status: 401, headers: corsHeaders });
        }

        const byteplusRes = await fetch(
          `${BYTEPLUS_API_BASE}/contents/generations/tasks/${taskId}`,
          {
            headers: { 'Authorization': authHeader },
          }
        );

        const result = await byteplusRes.text();
        return new Response(result, {
          status: byteplusRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 4. Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', service: 'cloudflare-workers' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
