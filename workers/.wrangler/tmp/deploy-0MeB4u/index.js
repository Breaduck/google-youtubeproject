// src/index.ts
var BYTEPLUS_API_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (url.pathname === "/api/v3/uploads" && request.method === "POST") {
        const body = await request.json();
        const base64Data = body.image.includes(",") ? body.image.split(",")[1] : body.image;
        const imgurRes = await fetch("https://api.imgur.com/3/image", {
          method: "POST",
          headers: {
            "Authorization": `Client-ID ${env.IMGUR_CLIENT_ID}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ image: base64Data, type: "base64" })
        });
        if (!imgurRes.ok) {
          throw new Error(`Imgur upload failed: ${imgurRes.status}`);
        }
        const result = await imgurRes.json();
        return new Response(JSON.stringify({ image_url: result.data.link }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (url.pathname === "/api/v3/content_generation/tasks" && request.method === "POST") {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) {
          return new Response("Authorization required", { status: 401, headers: corsHeaders });
        }
        const body = await request.json();
        const byteplusRes = await fetch(`${BYTEPLUS_API_BASE}/contents/generations/tasks`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: body.model || "seedance-1-0-pro-fast-251015",
            content: body.content
          })
        });
        const result = await byteplusRes.text();
        return new Response(result, {
          status: byteplusRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (url.pathname.startsWith("/api/v3/content_generation/tasks/") && request.method === "GET") {
        const taskId = url.pathname.split("/").pop();
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) {
          return new Response("Authorization required", { status: 401, headers: corsHeaders });
        }
        const byteplusRes = await fetch(
          `${BYTEPLUS_API_BASE}/contents/generations/tasks/${taskId}`,
          {
            headers: { "Authorization": authHeader }
          }
        );
        const result = await byteplusRes.text();
        return new Response(result, {
          status: byteplusRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok", service: "cloudflare-workers" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
