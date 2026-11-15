const ALLOWED_ORIGINS = ["https://meowmeow322.github.io"];
const DEFAULT_MODEL = "gemma-4-31b-it";
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
function hasCrisis(text) {
  const normalized = plain(String(text || ""));
  return CRISIS_WORDS.some((word) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`);
    return pattern.test(normalized);
  });
}
const apiKey = (env.GEMINI_API_KEY || "").trim();
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: "Cloudflare đang thấy biến: [" + Object.keys(env).join(", ") + "]" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`;

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  },
  body: JSON.stringify({ contents }),
});
function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) {
    hits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return false;
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Worker AI Gemma đang hoạt động.", {
        status: 200,
        headers: corsHeaders,
      });
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Bạn gửi tin nhắn hơi nhanh, vui lòng đợi một lát nhé." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const body = await request.json();
      const rawMessage = String(body.message || body.prompt || "").trim();

      if (!rawMessage) {
        return new Response(JSON.stringify({ error: "Tin nhắn trống." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const message = rawMessage.slice(0, MAX_MESSAGE);
      const lang = body.lang === "en" ? "en" : "vi";

      // Chỉ kiểm tra từ khóa khẩn cấp trên tin nhắn hiện tại, không quét lại lịch sử cũ
      if (hasCrisis(message)) {
        return new Response(
          JSON.stringify({ reply: CRISIS_REPLY[lang], crisis: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Chuẩn hóa lịch sử hội thoại (giới hạn theo MAX_HISTORY)
      const safeHistory = Array.isArray(body.history)
        ? body.history
            .slice(-MAX_HISTORY)
            .map((item) => {
              const role = item.role === "assistant" || item.role === "model" ? "model" : "user";
              const text = item.parts?.[0]?.text || item.text || item.content || "";
              return text ? { role, parts: [{ text: String(text).slice(0, MAX_MESSAGE) }] } : null;
            })
            .filter(Boolean)
        : [];

      const contents = [
        {
          role: "user",
          parts: [{ text: `Tuân thủ nghiêm ngặt hướng dẫn hệ thống sau:\n${SYSTEM_PROMPT}` }],
        },
        {
          role: "model",
          parts: [{ text: "Mình đã hiểu rõ và sẽ tuân thủ đầy đủ các nguyên tắc trên." }],
        },
        ...safeHistory,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ];

if (!env.GEMINI_API_KEY) {
  return new Response(
    JSON.stringify({ error: "Cloudflare chưa nhận được biến GEMINI_API_KEY!" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`;

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": env.GEMINI_API_KEY.trim(),
  },
  body: JSON.stringify({ contents }),
});

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: data?.error?.message || "Lỗi kết nối mô hình AI." }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Mình đang lắng nghe bạn đây, bạn có thể chia sẻ thêm một chút được không?";

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Lỗi xử lý máy chủ: " + err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};