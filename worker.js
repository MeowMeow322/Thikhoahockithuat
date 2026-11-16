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
    if (request.method === "GET") return new Response("Backend AI da san sang! | GEMINI_API_KEY: " + (env.GEMINI_API_KEY ? "OK" : "MISSING") + " | MODEL: " + (env.MODEL_NAME || DEFAULT_MODEL), { status: 200, headers: cors });
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

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const lang = body.lang === "en" ? "en" : "vi";
    if (!message) return json({ error: "Thiếu nội dung tin nhắn." }, 400, cors);
    if (message.length > MAX_MESSAGE) return json({ error: "Tin nhắn quá dài, hãy gửi ngắn hơn nhé." }, 400, cors);

    const history = (Array.isArray(body.history) ? body.history : [])
      .filter((h) => h && (h.role === "user" || h.role === "model") && typeof h.text === "string" && h.text.length <= MAX_MESSAGE * 2)
      .slice(-MAX_HISTORY);

    const userTexts = history.filter((h) => h.role === "user").map((h) => h.text).concat(message);
    if (userTexts.some(isCrisis)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);

    if (!env.GEMINI_API_KEY) return json({ error: "Máy chủ chưa được cấu hình." }, 500, cors);
    const model = env.MODEL_NAME || DEFAULT_MODEL;

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nHãy tuân thủ nghiêm ngặt các nguyên tắc trên." }] },
      { role: "model", parts: [{ text: "Mình hiểu rõ vai trò và sẽ tuân thủ các nguyên tắc này." }] },
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];

    const fallback = env.FALLBACK_MODEL || DEFAULT_FALLBACK;
    const models = fallback && fallback !== model ? [model, fallback] : [model];
    let lastCode = "network";
    const cfg = { temperature: 0.7, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "minimal" } };

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
            if (reply) return json({ reply }, 200, cors);
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
    return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + lastCode + ")" }, 502, cors);
  },
};
