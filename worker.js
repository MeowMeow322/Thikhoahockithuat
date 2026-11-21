const ALLOWED_ORIGINS = ["https://meowmeow322.github.io"];
const DEFAULT_MODEL = "gemma-4-26b-a4b-it";
const DEFAULT_FALLBACK = "gemma-4-31b-it";
const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60 * 1000;

const SYSTEM_PROMPT = `Bạn là trợ lý đồng hành thân thiện trên website thi khoa học kỹ thuật chăm sóc sức khỏe tinh thần của học sinh.
Nhiệm vụ: lắng nghe nhẹ nhàng, giải thích chung về kết quả tự đánh giá DASS (chỉ để tham khảo), gợi ý các hoạt động thư giãn như vẽ chấm trame, vẽ tự do, tô màu mandala, vẽ ra nhạc, hít thở chậm, nghe âm thanh thiên nhiên.
Nguyên tắc bắt buộc:
1. Chỉ trả lời các nội dung về cảm xúc, thư giãn và cách dùng website. Nếu được nhờ làm bài tập hoặc hỏi chủ đề khác, hãy từ chối lịch sự và đưa cuộc trò chuyện về cảm xúc của bạn ấy.
2. Không chẩn đoán bệnh, không đưa lời khuyên y tế, không nói về thuốc. Luôn nhắc rằng bạn chỉ là AI và không thay thế chuyên gia.
3. Khuyến khích bạn ấy chia sẻ với người tin tưởng như ba mẹ, thầy cô hoặc cô thầy phụ trách tâm lý của trường. Khi cần hỗ trợ, nhắc tổng đài quốc gia bảo vệ trẻ em 111 (miễn phí, 24/7) và cấp cứu 115.
4. Không hỏi và không lưu thông tin cá nhân như họ tên đầy đủ, địa chỉ, số điện thoại, trường lớp.
5. Trả lời ngắn gọn (tối đa khoảng 120 từ), ấm áp, bằng đúng ngôn ngữ của người dùng (tiếng Việt hoặc tiếng Anh).`;

const LISTEN_PROMPT = `CHẾ ĐỘ CHỈ LẮNG NGHE đang được bật.
Chỉ phản hồi bằng 1 đến 3 câu ngắn (tối đa khoảng 45 từ): phản chiếu lại cảm xúc bạn ấy vừa chia sẻ và cho bạn ấy biết mình đang lắng nghe.
Không đưa lời khuyên, không gợi ý hoạt động, không giải thích, không phân tích, không liệt kê.
Có thể kết thúc bằng một câu hỏi mở rất nhẹ như "Bạn muốn kể thêm không?". Nếu bạn ấy xin lời khuyên hoặc cách thư giãn, hãy nhắc nhẹ rằng đang ở chế độ chỉ lắng nghe và bạn ấy có thể tắt chế độ này trong khung chat.
Các nguyên tắc an toàn ở trên vẫn giữ nguyên.`;

const TASK_SYSTEM = `Bạn là trợ lý của website vẽ trị liệu giúp học sinh thư giãn. Bạn không chẩn đoán, không diễn giải tâm lý từ nét vẽ hay màu sắc, không đưa lời khuyên y tế. Chỉ trả về đúng nội dung được yêu cầu, không lời dẫn, không giải thích thêm, không dùng ký hiệu markdown.`;

const ART_MODES = {
  trame: "vẽ chấm trame",
  doodle: "vẽ tự do",
  coloring: "tô màu mandala",
  emotion: "vẽ cảm xúc bằng màu sắc",
  body: "quét cơ thể và tô vùng đang căng",
  prompt: "vẽ theo đề bài",
  music: "vẽ ra nhạc",
};

const CRISIS_WORDS = [
  "tu tu", "muon chet", "khong muon song", "ket thuc cuoc doi", "tu lam dau", "tu hai",
  "tu sat", "cat tay", "bien mat khoi the gioi", "song de lam gi",
  "suicide", "kill myself", "end my life", "want to die", "self-harm", "self harm", "hurt myself",
];

const CRISIS_REPLY = {
  vi: "Mình rất tiếc khi nghe bạn đang phải chịu cảm giác nặng nề như vậy. Bạn không phải đi một mình. Hãy nói ngay với một người lớn bạn tin tưởng (ba mẹ, thầy cô, cô thầy phụ trách tâm lý của trường) và ở cạnh họ lúc này. Bạn có thể gọi 111 (tổng đài quốc gia bảo vệ trẻ em, miễn phí, 24/7, có tư vấn tâm lý). Nếu bạn thấy không an toàn ngay lúc này, hãy gọi 115 hoặc nhờ người lớn ở gần gọi giúp. Mình chỉ là AI nên không thể thay thế sự giúp đỡ trực tiếp, nhưng bạn rất đáng được giúp đỡ.",
  en: "I'm really sorry you are carrying such a heavy feeling. You don't have to go through it alone. Please tell a trusted adult right now (a parent, teacher or the school counselor) and stay near them. In Vietnam you can call 111 (the national child protection hotline, free, 24/7, with psychological counseling). If you feel unsafe right now, call 115 or ask someone nearby to call for you. I am only an AI and cannot replace real help, but you deserve support.",
};

const hits = new Map();

function plain(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

function isCrisis(text) {
  const p = plain(text);
  return CRISIS_WORDS.some((w) => p.includes(w));
}

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 2000) hits.clear();
  return list.length > RATE_LIMIT;
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET") return new Response("Backend AI da san sang! | GEMINI_API_KEY: " + (env.GEMINI_API_KEY ? "OK" : "MISSING") + " | MODEL: " + (env.MODEL_NAME || DEFAULT_MODEL) + " | AI_IMAGE: " + (env.AI ? "OK" : "MISSING"), { status: 200, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (!allowed) return json({ error: "Forbidden" }, 403, cors);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (limited(ip)) return json({ error: "Bạn gửi hơi nhanh, hãy chờ một chút rồi thử lại nhé." }, 429, cors);

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Dữ liệu không hợp lệ." }, 400, cors);
    }

    const lang = body.lang === "en" ? "en" : "vi";
    const task = body.task === "daily_prompt" || body.task === "art_questions" || body.task === "generate_mandala" ? body.task : "";

    if (task === "generate_mandala") {
      if (!env.AI) return json({ error: lang === "en" ? "Image generation model is not enabled on the server yet." : "Mô hình tạo ảnh chưa được bật trên máy chủ Cloudflare." }, 503, cors);
      const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 100) : "";
      if (!topic) return json({ error: lang === "en" ? "Please enter a mandala theme." : "Bạn hãy nhập ý tưởng tranh Mandala nhé." }, 400, cors);
      if (isCrisis(topic)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);
      let imgPrompt = `symmetrical circular mandala coloring book page inspired by ${topic}, clean bold black ink outlines on pure white background, no shading, no gray, no color, simple closed regions for coloring, centered, minimalist line art`;
      if (env.GEMINI_API_KEY) {
        const gAsk = `Rewrite this student theme into ONE short English image prompt (max 35 words) for a symmetrical circular mandala coloring page: "${topic}". Requirements: calm, safe, positive, pure white background, crisp bold black ink outlines, closed shapes easy to color, strictly no shading, no grayscale, no colors, no text. Return only the English prompt.`;
        const gOut = await Promise.race([
          callModel(env, [
            { role: "user", parts: [{ text: TASK_SYSTEM }] },
            { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
            { role: "user", parts: [{ text: gAsk }] },
          ], { temperature: 0.7, maxOutputTokens: 120 }),
          new Promise((r) => setTimeout(() => r({}), 6000)),
        ]);
        if (gOut && gOut.reply) {
          const clean = String(gOut.reply).split(/\n/)[0].replace(/^["“\s]+|["”\s]+$/g, "").slice(0, 260);
          if (clean.length >= 12) imgPrompt = `${clean}, black and white coloring book line art, pure white background, clean bold black outlines, no shading, no color, no text`;
        }
      }
      try {
        const res = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: imgPrompt, steps: 4 });
        if (res && typeof res.image === "string" && res.image.length > 100) {
          return json({ image: "data:image/jpeg;base64," + res.image, prompt: imgPrompt }, 200, cors);
        }
        return json({ error: lang === "en" ? "Could not generate image right now. Please try again." : "Không tạo được ảnh lúc này, bạn thử lại sau nhé." }, 502, cors);
      } catch (err) {
        const detail = err && err.message ? " (" + String(err.message).slice(0, 80) + ")" : "";
        return json({ error: (lang === "en" ? "Image model is busy or reached daily free limit." : "Mô hình tạo ảnh đang bận hoặc chưa sẵn sàng.") + detail }, 502, cors);
      }
    }

    if (task) {
      if (!env.GEMINI_API_KEY) return json({ error: "Máy chủ chưa được cấu hình." }, 500, cors);
      const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
      const mood = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
      let ask;
      if (task === "daily_prompt") {
        const seed = Number.isFinite(body.seed) ? Math.abs(Math.floor(body.seed)) % 100000 : 0;
        ask = `Hãy viết MỘT đề bài vẽ ngắn (tối đa 25 từ) để học sinh thư giãn và biểu đạt cảm xúc nhẹ nhàng. Đề bài tích cực hoặc trung tính, dễ thực hiện trong 5 đến 10 phút, không nhắc đến chấn thương, bệnh tật, cái chết hay tự làm đau. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}. Hãy sáng tạo khác mọi lần (mã ngẫu nhiên ${seed}). Chỉ trả về câu đề bài.`;
      } else {
        const title = clip(body.title, 140);
        const note = clip(body.note, 140);
        if (isCrisis(title + " " + note)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);
        const modeName = ART_MODES[body.mode] || "vẽ";
        const b = mood(body.before), a = mood(body.after);
        const lines = [`Phương pháp: ${modeName}.`];
        if (title) lines.push(`Tên bạn ấy đặt cho bức vẽ: "${title}".`);
        if (b) lines.push(`Tâm trạng trước khi vẽ: ${b}/5.`);
        if (a) lines.push(`Tâm trạng sau khi vẽ: ${a}/5.`);
        if (note) lines.push(`Ghi chú của bạn ấy: "${note}".`);
        ask = `Một học sinh vừa vẽ xong. ${lines.join(" ")}\nHãy viết đúng 3 câu hỏi mở, ngắn, dịu dàng để bạn ấy tự nhìn lại bức vẽ và cảm xúc của mình (ví dụ về điều bạn ấy chú ý, cảm giác khi vẽ, điều muốn giữ lại). Không diễn giải hay đoán ý nghĩa bức vẽ, không đánh giá tâm lý, không đưa lời khuyên. Mỗi câu một dòng, không đánh số. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.`;
      }
      const out = await callModel(env, [
        { role: "user", parts: [{ text: TASK_SYSTEM }] },
        { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
        { role: "user", parts: [{ text: ask }] },
      ], { temperature: task === "daily_prompt" ? 0.95 : 0.7, maxOutputTokens: 300 });
      if (out.reply) return json({ reply: out.reply }, 200, cors);
      return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + out.code + ")" }, 502, cors);
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const listen = body.mode === "listen";
    if (!message) return json({ error: "Thiếu nội dung tin nhắn." }, 400, cors);
    if (message.length > MAX_MESSAGE) return json({ error: "Tin nhắn quá dài, hãy gửi ngắn hơn nhé." }, 400, cors);

    const history = (Array.isArray(body.history) ? body.history : [])
      .filter((h) => h && (h.role === "user" || h.role === "model") && typeof h.text === "string" && h.text.length <= MAX_MESSAGE * 2)
      .slice(-MAX_HISTORY);

    const userTexts = history.filter((h) => h.role === "user").map((h) => h.text).concat(message);
    if (userTexts.some(isCrisis)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);

    if (!env.GEMINI_API_KEY) return json({ error: "Máy chủ chưa được cấu hình." }, 500, cors);

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT + (listen ? "\n\n" + LISTEN_PROMPT : "") + "\n\nHãy tuân thủ nghiêm ngặt các nguyên tắc trên." }] },
      { role: "model", parts: [{ text: "Mình hiểu rõ vai trò và sẽ tuân thủ các nguyên tắc này." }] },
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];

    const out = await callModel(env, contents, listen ? { temperature: 0.6, maxOutputTokens: 220 } : {});
    if (out.reply) return json({ reply: out.reply }, 200, cors);
    return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + out.code + ")" }, 502, cors);
  },
};

async function callModel(env, contents, override) {
  const model = env.MODEL_NAME || DEFAULT_MODEL;
  const fallback = env.FALLBACK_MODEL || DEFAULT_FALLBACK;
  const models = fallback && fallback !== model ? [model, fallback] : [model];
  let lastCode = "network";
  const cfg = { temperature: 0.7, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "minimal" }, ...(override || {}) };

  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({ contents, generationConfig: cfg }),
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
          if (reply) return { reply };
          lastCode = "empty";
          break;
        }
        const raw = (await res.text()).slice(0, 800);
        console.log("Upstream error", m, res.status, raw);
        lastCode = String(res.status);
        try { const e = JSON.parse(raw).error; if (e && e.status) lastCode += " " + e.status; } catch (_) {}
        if (res.status === 400 && cfg.thinkingConfig) { delete cfg.thinkingConfig; attempt--; continue; }
        if (res.status === 500 || res.status === 503) {
          if (attempt === 0) { await new Promise((r) => setTimeout(r, 700)); continue; }
        }
        break;
      } catch (err) {
        console.log("Worker error", m, String(err));
        lastCode = "network";
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 700)); continue; }
      }
    }
  }
  return { code: lastCode };
}
