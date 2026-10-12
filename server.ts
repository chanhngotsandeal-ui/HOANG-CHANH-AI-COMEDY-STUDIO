import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Helper: Count Vietnamese words separated by whitespace
function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Helper: Strictly enforce max words limit on dialogue list without ever changing character names
function enforceMaxWordsOnDialogue(
  dialogueList: { characterName: string; text: string; tone?: string }[],
  maxWords: number
): { characterName: string; text: string; tone?: string }[] {
  let currentWords = dialogueList.reduce((sum, d) => sum + countWords(d.text), 0);
  if (currentWords <= maxWords) {
    return dialogueList;
  }

  // Preserve exact character names, roles, and tones from input
  const cloned = dialogueList.map((d) => ({ ...d }));
  while (cloned.reduce((sum, d) => sum + countWords(d.text), 0) > maxWords) {
    // Find the longest sentence
    let maxIdx = 0;
    let maxLen = 0;
    cloned.forEach((d, idx) => {
      const len = countWords(d.text);
      if (len > maxLen) {
        maxLen = len;
        maxIdx = idx;
      }
    });

    const words = cloned[maxIdx].text.trim().split(/\s+/);
    if (words.length > 2) {
      words.pop();
      cloned[maxIdx].text = words.join(' ') + (cloned[maxIdx].text.endsWith('!') ? '!' : cloned[maxIdx].text.endsWith('?') ? '?' : '.');
    } else {
      break;
    }
  }

  return cloned;
}

// 1. Check AI connection status
app.get('/api/ai/status', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return res.json({
      available: false,
      message: 'GEMINI_API_KEY chưa được cấu hình trên máy chủ. Tính năng AI viết lại kịch bản chưa khả dụng.',
    });
  }

  return res.json({
    available: true,
    model: 'gemini-3.8-flash',
    message: 'Kết nối AI Gemini khả dụng (gemini-3.8-flash).',
  });
});

// 2. Condense dialogues with Gemini AI
app.post('/api/ai/fix-dialogues', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(503).json({
      success: false,
      available: false,
      error: 'Chưa có kết nối GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra biến môi trường.',
    });
  }

  const { scriptTitle, scenes } = req.body;
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ success: false, error: 'Danh sách phân cảnh không hợp lệ.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const sceneDescriptions = scenes
      .map((s: any) => {
        const dText = (s.currentDialogue || [])
          .map((d: any) => `${d.characterName}: "${d.text}"`)
          .join('\n');
        return `CẢNH ${s.sceneNumber} (${s.durationSeconds}s, GIỚI HẠN TỐI ĐA: ${s.maxWords} TỪ):
Hành động: ${s.actionDescription || ''}
Lời thoại hiện tại (${s.currentWords || countWords((s.currentDialogue || []).map((d: any) => d.text).join(' '))} từ - quá dài):
${dText}`;
      })
      .join('\n\n');

    const prompt = `Bạn là biên kịch sitcom hài gia đình Việt Nam của studio HOÀNG CHANH AI COMEDY STUDIO.
Dự án phim: "${scriptTitle || 'Phim hài gia đình ngắn'}"

Nhiệm vụ: Hãy rút gọn lời thoại cho các phân cảnh sau đây, đảm bảo các nguyên tắc bất di bất dịch:
1. GIỚI HẠN TỪ NGHIÊM NGẶT: Tổng số từ của toàn bộ lời thoại trong mỗi cảnh TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT QUÁ số từ tối đa quy định.
   - Cảnh 8 giây: Tối đa 17 từ (không quá 17 từ).
   - Cảnh 6 giây: Tối đa 13 từ (không quá 13 từ).
   (Đếm từ theo chuẩn tiếng Việt, mỗi từ cách nhau bởi dấu cách).
2. GIỮ NGUYÊN Ý NGHĨA & TÍNH HÀI HƯỚC: Giữ trọn miếng hài, cá tính nhân vật (Ba Chanh, Mẹ Huệ, Bông, Cún...), phản ứng éo le và cú twist bất ngờ.
3. TỰ NHIÊN, DỄ DIỄN ĐẠT: Câu thoại tiếng Việt đời thường, dí dỏm, ngắt nhịp đúng chỗ, tạo khoảng nghỉ cho biểu cảm khuôn mặt.
4. KHÔNG NÓI CHỒNG CHÉO: Trong cảnh ngắn, chỉ nên có 1 hoặc tối đa 2 câu đối đáp ngắn gọn, súc tích.
5. GIỮ ĐÚNG TÊN NHÂN VẬT: Giữ nguyên chính xác tên nhân vật trong kịch bản gốc.

DANH SÁCH CÁC CẢNH CẦN RÚT GỌN LỜI THOẠI:
${sceneDescriptions}

Hãy trả về DUY NHẤT một mảng JSON theo mẫu sau, không kèm bất kỳ giải thích nào khác ngoài JSON:
[
  {
    "sceneNumber": 2,
    "dialogue": [
      {
        "characterName": "Tên nhân vật",
        "text": "Câu thoại đã rút gọn đúng giới hạn từ",
        "tone": "sắc thái biểu cảm"
      }
    ]
  }
]`;

    // Attempt model calls with fallback per AI Studio SKILL guidelines
    let responseText = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying fallback...`, err.message?.slice(0, 100));
      }
    }

    if (!responseText) {
      throw lastError || new Error('Không nhận được phản hồi từ mô hình AI.');
    }

    // Clean JSON text
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedJson = JSON.parse(cleanedText);
    if (!Array.isArray(parsedJson)) {
      throw new Error('Dữ liệu trả về không phải là mảng JSON hợp lệ.');
    }

    // Map and enforce word limits without modifying character identities
    const fixedScenes = scenes.map((origScene: any) => {
      const match = parsedJson.find((p: any) => p.sceneNumber === origScene.sceneNumber);
      let newDialogue = origScene.currentDialogue;
      if (match && Array.isArray(match.dialogue) && match.dialogue.length > 0) {
        newDialogue = match.dialogue.map((d: any, dIdx: number) => ({
          characterName: origScene.currentDialogue[dIdx]?.characterName || d.characterName || (origScene.currentDialogue[0]?.characterName ?? 'NHÂN VẬT'),
          text: String(d.text || '').trim(),
          tone: d.tone || origScene.currentDialogue[dIdx]?.tone || 'tự nhiên hài hước',
        }));
      }

      // Enforce strict word count <= maxWords without modifying names
      newDialogue = enforceMaxWordsOnDialogue(newDialogue, origScene.maxWords);
      const totalWords = newDialogue.reduce((sum: number, d: any) => sum + countWords(d.text), 0);

      return {
        sceneId: origScene.sceneId,
        sceneNumber: origScene.sceneNumber,
        durationSeconds: origScene.durationSeconds,
        maxWords: origScene.maxWords,
        oldDialogue: origScene.currentDialogue,
        oldWordCount: origScene.currentWords,
        dialogue: newDialogue,
        newWordCount: totalWords,
      };
    });

    return res.json({
      success: true,
      available: true,
      fixedScenes,
    });
  } catch (error: any) {
    console.error('Lỗi khi gọi AI Gemini:', error);
    return res.status(500).json({
      success: false,
      available: false,
      error: `Không thể kết nối dịch vụ AI để sửa kịch bản: ${error.message || 'Lỗi hệ thống'}`,
    });
  }
});

// 3. Generate Scene Image with Face Reference Priority V2
app.post('/api/ai/generate-scene-image', async (req, res) => {
  const { sceneId, sceneNumber, sceneTitle, prompt, characters, aspectRatio = '9:16' } = req.body || {};
  if (!Array.isArray(characters) || characters.length === 0 || characters.some((c: any) => !c?.id || !(c.referenceImage || c.avatarUrl))) {
    return res.status(400).json({ success: false, available: false, error: 'Thiếu ảnh tham chiếu gốc của nhân vật.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isApiKeyAvailable = !!apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY';

  // Sample verified shot for Scene 1 with Ba Chanh face reference
  const scene1Sample = '/src/assets/images/scene_1_ba_chanh_face_ref_916.jpg';

  if (!isApiKeyAvailable) {
    return res.json({
      success: false,
      available: false,
      sceneId,
      error: 'GEMINI_API_KEY chưa được cấu hình trên máy chủ.',
      message: 'Chưa kết nối dịch vụ AI tạo ảnh hoặc chưa có GEMINI_API_KEY trên máy chủ. Bạn có thể tải ảnh tham chiếu khuôn mặt gốc và prompt sang công cụ tạo ảnh bên ngoài (Midjourney v6.1 --cref, Flux PuLID, Fooocus FaceSwap, Kling I2V).',
      sampleImage: sceneId === 'scene_qd_1' ? scene1Sample : undefined,
      externalToolGuidance: {
        midjourneySyntax: `--cref [URL_ẢNH_THAM_CHIẾU_GỐC] --cw 100 --ar 9:16`,
        fluxSyntax: `IP-Adapter Face / PuLID: weight 0.85, fidelity 1.0`,
        klingSyntax: `Image-to-Video: Dùng ảnh cảnh sau khi tạo với face reference`,
      },
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    let attachedReferences = 0;

    // Attach Face Reference images for each character appearing in the scene
    if (Array.isArray(characters) && characters.length > 0) {
      for (const char of characters) {
        const refPath = char.referenceImage || char.avatarUrl;
        if (refPath) {
          let base64Data: string | null = null;
          let mimeType = 'image/jpeg';

          if (refPath.startsWith('data:image/')) {
            const matches = refPath.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
            }
          } else if (refPath.startsWith('/src/') || refPath.startsWith('src/')) {
            const relativePath = refPath.startsWith('/') ? refPath.slice(1) : refPath;
            const fullPath = path.resolve(__dirname, relativePath);
            if (fs.existsSync(fullPath)) {
              const fileBuffer = fs.readFileSync(fullPath);
              base64Data = fileBuffer.toString('base64');
              if (fullPath.endsWith('.png')) mimeType = 'image/png';
              else if (fullPath.endsWith('.webp')) mimeType = 'image/webp';
            }
          }

          if (base64Data) {
            attachedReferences++;
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType,
              },
            });
            parts.push({
              text: `[ẢNH KHUÔN MẶT THAM CHIẾU GỐC (FACE REFERENCE V2) - ID: ${char.id} - ${char.name}]:
Đây là ảnh gốc chuẩn của nhân vật ${char.name} (${char.role || ''}, ${char.age || ''}).
YÊU CẦU BẮT BUỘC: Giữ nguyên tuyệt đối nhận diện khuôn mặt, cấu trúc gương mặt, mắt, mũi, miệng, đặc điểm nhận diện (ria mép, nụ cười), độ tuổi và màu da của người trong ảnh này.`
            });
          }
        }
      }
    }

    if (attachedReferences !== characters.length) {
      return res.status(422).json({ success: false, available: false, error: 'Không đọc được đầy đủ ảnh tham chiếu. Hãy tải lại ảnh trong mục Nhân Vật.' });
    }

    const sceneInstruction = `[YÊU CẦU TẠO ẢNH PHÂN CẢNH 9:16 DỌC - HOÀNG CHANH AI COMEDY STUDIO]:
Tạo 1 bức ảnh phân cảnh điện ảnh sitcom hài gia đình Việt Nam tỉ lệ dọc 9:16 (aspect ratio 9:16).
QUY TẮC NHẬN DIỆN KHUÔN MẶT GỐC (FACE PRIORITY):
1. GIỮ NGUYÊN NHẬN DIỆN: Sử dụng chính xác khuôn mặt từ ảnh tham chiếu gốc ở trên cho nhân vật tương ứng. Không thay đổi khuôn mặt sang người khác.
2. THAY ĐỔI THEO KỊCH BẢN: Chỉ thay đổi tư thế, động tác, trang phục, biểu cảm hài hước, đạo cụ và bối cảnh phòng khách theo đúng miêu tả phân cảnh dưới đây:
Phân cảnh: ${sceneTitle || ''}
Nội dung hành động & góc máy: ${prompt || 'Cận cảnh hành động hài hước dọc 9:16'}
Ánh sáng: Ấm áp tự nhiên căn hộ gia đình Việt Nam, màu sắc sắc nét 8k, phong cách phim sitcom chất lượng cao. Tỉ lệ khung hình: 9:16 dọc.`;

    parts.push({ text: sceneInstruction });

    // Call image generation model with fallback per guidelines
    let generatedImageData: string | null = null;
    const modelsToTry = [process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: '9:16',
            },
          },
        });

        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              generatedImageData = `data:${mime};base64,${part.inlineData.data}`;
              break;
            }
          }
        }
        if (generatedImageData) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Image generation with model ${model} failed:`, err.message?.slice(0, 150));
      }
    }

    if (generatedImageData) {
      return res.json({
        success: true,
        available: true,
        sceneId,
        imageUrl: generatedImageData,
        source: 'gemini_multimodal_face_ref',
        message: 'Đã tạo ảnh AI có dùng ảnh tham chiếu. Cần người dùng kiểm tra độ giống khuôn mặt và duyệt thủ công.',
      });
    }

    // If API failed due to quota or other error
    return res.json({
      success: false,
      available: false,
      sceneId,
      error: lastError?.message || 'Không thể tạo ảnh từ mô hình AI.',
      message: `Dịch vụ AI tạo ảnh phản hồi: ${lastError?.message || 'Hạn mức quota hoặc mô hình bận'}. Bạn có thể tải ảnh tham chiếu gốc và sao chép prompt để tạo ngoài.`,
      sampleImage: sceneId === 'scene_qd_1' ? scene1Sample : undefined,
      externalToolGuidance: {
        midjourneySyntax: `--cref [URL_ẢNH_THAM_CHIẾU_GỐC] --cw 100 --ar 9:16`,
        fluxSyntax: `IP-Adapter Face / PuLID: weight 0.85, fidelity 1.0`,
        klingSyntax: `Image-to-Video: Dùng ảnh cảnh sau khi tạo với face reference`,
      },
    });
  } catch (error: any) {
    console.error('Lỗi khi gọi API tạo ảnh cảnh với face reference:', error);
    return res.status(500).json({
      success: false,
      available: false,
      sceneId,
      error: error.message || 'Lỗi server',
      message: `Không thể kết nối dịch vụ tạo ảnh AI: ${error.message || 'Lỗi hệ thống'}.`,
      sampleImage: sceneId === 'scene_qd_1' ? scene1Sample : undefined,
    });
  }
});

// Serve frontend with Vite middlewares in development or static in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`HOÀNG CHANH AI COMEDY STUDIO server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
