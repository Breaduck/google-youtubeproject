# 📚 Official LTX-2 Prompting Guide 적용

## 출처

```
Source: https://ltx.io/model/model-blog/prompting-guide-for-ltx-2
Applied: 2026-02-01
Status: ✓ Integrated into Gemini prompt generation
```

---

## 🎯 공식 LTX-2 6-Element Structure

### Before (5-Step Formula)
```
1. Subject
2. Action
3. Camera
4. Quality
5. Constraint
```

### After (Official 6-Element Structure)
```
1. Shot establishment: Cinematography terminology
2. Scene setting: Lighting, color palette, textures, mood
3. Action sequence: Natural movements (start → finish)
4. Character definition: Visual emotional cues through physicality
5. Camera movement: Specific directions
6. Audio/dialogue: Ambient sounds, dialogue in quotes, vocal style
```

---

## 📝 Best Practices (Official Guide)

### Format
- ✅ Single flowing paragraph (NOT bullet points)
- ✅ 4-8 descriptive sentences
- ✅ Present tense for all movement/action
- ✅ Match detail level to shot scale
- ✅ Direct, not over-complicated

### Emotion Expression (CRITICAL)
```
❌ Wrong: "Character is sad"
❌ Wrong: "Character feels happy"

✅ Correct: "Shoulders slumped forward, eyes glistening with tears"
✅ Correct: "Face brightening with broad smile, eyes squinting with joy"
```

**Rule:** Show emotion through VISUAL CUES (posture, gestures, facial expressions), NOT labels!

---

## ✅ What Works Well (from Official Guide)

### LTX-2 Excels At:
```
✅ Cinematic compositions with thoughtful lighting
✅ Single-subject emotional expressions
✅ Subtle gestures and facial movements
✅ Atmospheric elements (fog, rain, golden hour, reflections)
✅ Clear camera language ("slow dolly in", "handheld tracking")
✅ Stylized aesthetics (animation, noir, surreal)
✅ Shallow depth of field
✅ Voice work in multiple languages
```

---

## ❌ What to Avoid (from Official Guide)

### LTX-2 Struggles With:
```
❌ Internal emotional states without visual cues
   → "character is sad" → NO!
   → "shoulders slumped, tears falling" → YES!

❌ Text and logos
   → LTX-2 cannot generate readable text consistently

❌ Complex physics
   → Jumping, juggling cause artifacts
   → Dancing works better

❌ Scene overload
   → Too many characters reduces accuracy
   → Too many layered actions

❌ Conflicting lighting logic
   → Avoid unmotivated light source clashes

❌ Overcomplicated prompts
   → Add instructions iteratively, not all at once
```

---

## 🎬 Example Transformation

### Before (5-Step Formula)
```
Input: "I can't believe this happened..."

Output:
"Character with sad expression, teary eyes, lips moving according to dialogue,
slight head shake, slow dolly-in camera movement, 2D animation style,
smooth motion, vibrant colors, avoid wobbling, avoid realistic"
```

**Problems:**
- "sad expression" = emotional label (not visual cue)
- Bullet-point style
- Missing shot establishment, scene setting, audio

---

### After (Official 6-Element Structure)
```
Input: "I can't believe this happened..."

Output:
"Medium shot in soft diffused lighting with muted color palette. Character's
shoulders slumped forward, head tilting downward, eyes glistening with tears,
lips trembling and forming words. Hands fidgeting nervously at sides, breathing
visibly heavy. Slow dolly in toward face as expression deepens. 2D animation
style with smooth motion and subtle shadows. Ambient sound of quiet breathing,
dialogue 'I can't believe this happened...' spoken in shaky, quiet voice."
```

**Improvements:**
- ✅ Shot establishment: "Medium shot"
- ✅ Scene setting: "soft diffused lighting with muted color palette"
- ✅ Visual emotional cues: "shoulders slumped", "eyes glistening", "lips trembling"
- ✅ Action sequence: "head tilting downward", "hands fidgeting", "breathing heavy"
- ✅ Camera movement: "Slow dolly in toward face"
- ✅ Audio: "quiet breathing, dialogue '...' in shaky voice"
- ✅ Single flowing paragraph
- ✅ Present tense

---

## 🎨 2D Animation Optimizations

### Scene Setting for 2D Animation
```
Lighting:
- "soft diffused lighting"
- "warm golden lighting"
- "dramatic side lighting"

Color Palette:
- "vibrant color palette"
- "muted color palette"
- "high contrast colors"

Textures:
- "smooth motion"
- "stylized aesthetic"
- "subtle shadows"
- "bright highlights"
```

### Camera Movement for 2D
```
Works Best:
- "slow dolly in"
- "gentle camera pan right/left"
- "subtle zoom in"
- "smooth camera drift"
- "handheld tracking" (for dynamic scenes)

Avoid:
- Too fast movements
- Complex tracking shots
- Unmotivated camera shakes
```

---

## 🎭 Emotion → Visual Cues Mapping

### Sadness
```
❌ "character is sad"

✅ Visual Cues:
- "shoulders slumped forward"
- "head tilting downward"
- "eyes glistening with tears"
- "lips trembling"
- "hands hanging limply at sides"
- "breathing heavily"
```

### Happiness
```
❌ "character is happy"

✅ Visual Cues:
- "face brightening with broad smile"
- "eyes squinting with joy"
- "head tilting back slightly"
- "shoulders shaking with laughter"
- "hands clapping together"
- "body bouncing with energy"
```

### Anger
```
❌ "character is angry"

✅ Visual Cues:
- "eyebrows furrowed tightly"
- "jaw clenched"
- "fists balling up"
- "body tensing"
- "eyes narrowing intensely"
- "breathing sharply through nose"
```

### Surprise
```
❌ "character is surprised"

✅ Visual Cues:
- "eyes widening suddenly"
- "eyebrows shooting upward"
- "mouth dropping open"
- "hand flying to mouth"
- "body jerking backward"
- "sharp intake of breath"
```

---

## 📊 Comparison

| Aspect | Before (5-Step) | After (Official 6-Element) |
|--------|-----------------|----------------------------|
| **Structure** | 5 elements | 6 elements ✅ |
| **Format** | Mixed | Single paragraph ✅ |
| **Emotion** | Labels ("sad") | Visual cues ✅ |
| **Shot** | Missing | "Medium shot" ✅ |
| **Scene** | Minimal | Lighting + color ✅ |
| **Audio** | Missing | Dialogue + ambient ✅ |
| **Length** | 2-3 sentences | 4-8 sentences ✅ |
| **Tense** | Mixed | Present tense ✅ |
| **LTX-2 Aligned** | Partial | Official guide ✅ |

---

## 🚀 Expected Improvements

### From Official Structure
```
✅ More cinematic compositions
✅ Better emotional expression (visual cues)
✅ Richer scene atmosphere (lighting, color)
✅ More natural action sequences
✅ Clearer camera language
✅ Better audio/dialogue integration
```

### From 2D Animation Focus
```
✅ Stylized aesthetic maintained
✅ Vibrant colors emphasized
✅ Smooth motion prioritized
✅ Avoid photorealistic conflicts
```

---

## 📝 Gemini Prompt Updates

### Key Changes
```
Before:
- "5-STEP FORMULA"
- Bullet points style
- Emotion labels ("sad expression")
- 2-3 sentence output

After:
- "OFFICIAL LTX-2 6-ELEMENT STRUCTURE"
- Single flowing paragraph
- Visual emotional cues ("shoulders slumped, eyes glistening")
- 4-8 sentence output
- Shot establishment + scene setting + audio
```

### New Instructions for Gemini
```
CRITICAL RULES:
- Single flowing paragraph (4-8 sentences, present tense)
- Show emotion through VISUAL CUES (posture, expressions) NOT labels
- Match dialogue emotion to visual: crying → teary eyes, slumped posture
- MANDATORY camera movement
- 2D animation aesthetic (vibrant colors, stylized)
- Avoid: complex physics, too many characters, text/logos
```

---

## ✅ Deployment Status

```
✓ geminiService.ts updated
✓ Official 6-element structure integrated
✓ Best practices from official guide applied
✓ Examples updated with flowing paragraphs
✓ Visual emotional cue mapping added
✓ GitHub: Committed & Pushed (bc94d0f)
✓ Cloudflare Pages: Auto-deploying
```

---

## 🎯 Testing Priority

### Test Cases
1. **Emotion Expression:**
   - Input: Sad dialogue
   - Expected: Visual cues (slumped shoulders, glistening eyes)
   - NOT: Labels ("sad character")

2. **Scene Atmosphere:**
   - Expected: Lighting + color palette description
   - Example: "soft diffused lighting with muted color palette"

3. **Audio Integration:**
   - Expected: Dialogue in quotes + vocal style
   - Example: "dialogue 'I can't believe...' spoken in shaky voice"

4. **Paragraph Flow:**
   - Expected: Single flowing paragraph, 4-8 sentences
   - NOT: Bullet points or fragments

---

## 📚 Reference

**Official Guide:**
```
https://ltx.io/model/model-blog/prompting-guide-for-ltx-2
```

**Key Takeaways:**
1. Show, don't tell (visual cues > emotion labels)
2. Single flowing paragraph (4-8 sentences)
3. 6-element structure (shot, scene, action, character, camera, audio)
4. Present tense for all action
5. LTX-2 excels at: single-subject emotions, atmospheric elements, stylized aesthetics
6. LTX-2 struggles with: emotion labels, text, complex physics, scene overload

---

## ✅ 완료!

**Official LTX-2 Guide Integration:**
- ✅ 6-element structure
- ✅ Visual emotional cues
- ✅ Single flowing paragraph
- ✅ Shot establishment + scene setting
- ✅ Audio/dialogue integration
- ✅ Best practices applied

**더 나은 프롬프트 = 더 나은 영상!** 📚✨
