# YouTube Storyboard Generator

AI-powered storyboard and video generation for YouTube content creation.

## Features

- 📝 Script-based storyboard generation using Gemini AI
- 🎨 Automatic image generation for each scene
- 🎬 Image-to-video conversion using LTX Video model
- 📹 High-quality 1024x576 video output (16:9)
- ⚡ Fast parallel processing for batch video generation

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **AI Models:**
  - Google Gemini 2.0 Flash (script & image generation)
  - Lightricks LTX-Video-0.9.8 (image-to-video)
- **Backend:** Modal serverless (A10G GPU)
- **Deployment:** Cloudflare Pages

## Recent Updates (2025-02-01)

### Critical Image Conditioning Fixes ✓
Fixed LTX Video model ignoring input images and generating different characters:
- Lowered guidance_scale from 8.5 to 4.0 for stronger image conditioning
- Removed all appearance descriptions from prompts (motion only)
- Added explicit negative prompts to prevent character changes
- Implemented first-frame verification and forced replacement
- Enhanced debugging logs for production monitoring

**Result:** Input image characters are now preserved exactly with only subtle natural motion.

## Quick Start

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Environment Variables
Create `.env` file:
```
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## Architecture

```
User Script → Gemini AI → Scene Breakdown
              ↓
         Image Generation (Gemini Imagen)
              ↓
         Video Generation (LTX Video on Modal)
              ↓
         Download & Export
```

## Modal API Endpoint

Production: `https://hiyoonsh1--ltx-video-service-v2-web-app.modal.run`

### API Endpoints
- `POST /generate` - Single video generation
- `POST /batch-generate` - Batch processing (up to 10 parallel)
- `GET /health` - Health check

## Video Generation Parameters

- **Resolution:** 1024x576 (16:9 aspect ratio)
- **Frame Rate:** 24fps
- **Duration:** ~4 seconds (97 frames per scene)
- **Quality:** High (guidance_scale: 4.0)
- **Motion:** Subtle natural movements only

## Testing

Test page available at: `test-modal-base64.html`

## License

Private project
