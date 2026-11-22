const ALLOWED_ORIGINS = ["https://meowmeow322.github.io"];
const DEFAULT_MODEL = "gemma-4-26b-a4b-it";
const DEFAULT_FALLBACK = "gemma-4-31b-it";
const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60 * 1000;

const AUDIENCE_CTX = {
  general: {
    vi: "Người dùng ở độ tuổi bất kỳ cần thư giãn tinh thần và cân bằng cảm xúc trong cuộc sống hằng ngày.",
    en: "A general user of any age looking for everyday mental relaxation and emotional balance.",
  },
  student: {
    vi: "Người dùng là học sinh hoặc sinh viên (có thể liên quan đến áp lực học tập, thi cử, bạn bè).",
    en: "The user is a student (may relate to study load, exams, or peer pressure).",
  },
  worker: {
    vi: "Người dùng là người đi làm / nhân viên văn phòng (có thể liên quan đến deadline, quá tải công việc, burnout, cần nghỉ ngơi sau giờ làm).",
    en: "The user is a working professional (may relate to deadlines, work overload, burnout, or unwinding after work).",
  },
  adult: {
    vi: "Người dùng là người trưởng thành / phụ huynh / người lớn tuổi (có thể liên quan đến cân bằng gia đình, giấc ngủ, sự bình yên nội tâm).",
    en: "The user is an adult or family caregiver (may relate to family balance, rest, sleep, and inner calm).",
  },
};

const SYSTEM_PROMPT = `Bạn là trợ lý đồng hành thân thiện, ấm áp và tôn trọng trên website tự đánh giá tâm lý DASS kết hợp hội họa trị liệu dành cho mọi lứa tuổi.
Nhiệm vụ: lắng nghe nhẹ nhàng, giải thích chung về kết quả tự đánh giá DASS (chỉ để tham khảo), gợi ý các hoạt động thư giãn như vẽ chấm trame, vẽ tự do, tô màu mandala, vẽ ra nhạc, hít thở chậm, neo giác quan 5-4-3-2-1, nghe âm thanh thiên nhiên.
Nguyên tắc bắt buộc:
1. Chỉ trả lời các nội dung về cảm xúc, thư giãn và cách dùng website. Nếu được nhờ làm việc khác ngoài chủ đề sức khỏe tinh thần, hãy từ chối lịch sự và đưa cuộc trò chuyện về cảm xúc của người dùng.
2. Không chẩn đoán bệnh, không đưa lời khuyên y tế, không nói về thuốc. Luôn nhắc rằng bạn chỉ là AI và không thay thế chuyên gia.
3. Khuyến khích chia sẻ với người thân, bạn bè tin cậy, chuyên gia tâm lý hoặc cơ sở y tế gần nhất. Khi cần hỗ trợ khẩn cấp tại Việt Nam, nhắc tổng đài 111 (miễn phí, 24/7) và cấp cứu 115.
4. Không hỏi và không lưu thông tin cá nhân nhạy cảm như họ tên đầy đủ, địa chỉ, số điện thoại.
5. Trả lời ngắn gọn (tối đa khoảng 120 từ), ấm áp, xưng hô lịch sự phù hợp mọi lứa tuổi, bằng đúng ngôn ngữ của người dùng (tiếng Việt hoặc tiếng Anh).`;

const LISTEN_PROMPT = `CHẾ ĐỘ CHỈ LẮNG NGHE đang được bật.
Chỉ phản hồi bằng 1 đến 3 câu ngắn (tối đa khoảng 45 từ): phản chiếu lại cảm xúc người dùng vừa chia sẻ và cho họ biết mình đang lắng nghe.
Không đưa lời khuyên, không gợi ý hoạt động, không giải thích, không phân tích, không liệt kê.
Có thể kết thúc bằng một câu hỏi mở rất nhẹ như "Bạn muốn kể thêm không?". Nếu người dùng xin lời khuyên, hãy nhắc nhẹ rằng đang ở chế độ chỉ lắng nghe và có thể tắt chế độ này trong khung chat.
Các nguyên tắc an toàn ở trên vẫn giữ nguyên.`;

const TASK_SYSTEM = `Bạn là trợ lý của website hội họa trị liệu giúp người dùng mọi lứa tuổi thư giãn và tự chiêm nghiệm. Bạn không chẩn đoán bệnh, không đưa lời khuyên y tế. Chỉ trả về đúng nội dung được yêu cầu, không lời dẫn thừa, không dùng ký hiệu markdown.`;

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
  vi: "Mình rất tiếc khi nghe bạn đang phải chịu cảm giác nặng nề như vậy. Bạn không phải đi một mình. Hãy nói ngay với người thân, bạn bè tin cậy hoặc chuyên gia tâm lý và ở cạnh họ lúc này. Bạn có thể gọi 111 (miễn phí, 24/7, có tư vấn tâm lý). Nếu bạn thấy không an toàn ngay lúc này, hãy gọi 115 hoặc nhờ người ở gần gọi giúp. Mình chỉ là AI nên không thể thay thế sự giúp đỡ trực tiếp, nhưng bạn rất đáng được lắng nghe và hỗ trợ.",
  en: "I'm really sorry you are carrying such a heavy feeling. You don't have to go through it alone. Please reach out to a loved one, trusted friend, or mental health professional right now and stay near someone you trust. In Vietnam you can call 111 (free, 24/7, with counseling) or 115 for emergencies. I am only an AI and cannot replace real help, but you deserve care and support.",
};

const hits = new Map();

function plain(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
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

function getAudience(v) {
  return v === "student" || v === "worker" || v === "adult" ? v : "general";
}

function audienceHint(aud, lang) {
  const a = AUDIENCE_CTX[getAudience(aud)] || AUDIENCE_CTX.general;
  return lang === "en" ? a.en : a.vi;
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
    const audience = getAudience(body.audience || (body.context && body.context.audience));
    const allowedTasks = ["daily_prompt", "art_questions", "generate_mandala", "generate_starter", "explain_dass", "weekly_insight", "cbt_reframe", "ai_melody"];
    const task = allowedTasks.includes(body.task) ? body.task : "";

    if (task === "generate_mandala" || task === "generate_starter") {
      if (!env.AI) return json({ error: lang === "en" ? "Image generation model is not enabled on the server yet." : "Mô hình tạo ảnh chưa được bật trên máy chủ Cloudflare." }, 503, cors);
      const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 100) : "";
      if (!topic) return json({ error: lang === "en" ? "Please enter a theme." : "Bạn hãy nhập ý tưởng tranh nhé." }, 400, cors);
      if (isCrisis(topic)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);
      const pTopic = plain(topic);
      const isStarter = task === "generate_starter";
      const presetMap = isStarter ? {
        "tach tra am": "a simple warm teacup with gentle steam",
        "choi cay nho": "a small sprouting seedling plant in a round pot",
        "ngon doi & mat troi": "two gentle rolling hills with a simple rising sun",
        "chu chim nho": "a cute minimal little songbird perched on a twig",
      } : {
        "hoa sen": "geometric lotus flower petals pattern",
        "song bien": "gentle circular ocean waves pattern",
        "khu rung": "peaceful botanical forest leaves pattern",
        "canh buom": "symmetric butterfly wings decorative pattern",
      };
      const baseTheme = presetMap[pTopic] || topic;
      const safePrompt = isStarter
        ? "ultra-simple minimalist beginner drawing template of a small potted plant and sun, single clean continuous black outline on pure white background, basic geometric shapes, very few lines, large empty white spaces, easy to copy and trace by hand, no shading, no gradients, no color, high contrast black line art"
        : "symmetrical circular geometric floral mandala coloring book page, clean bold black ink outlines on pure white background, simple closed petal shapes for coloring, centered, no shading, no gray, no color, minimalist line art";
      let imgPrompt = isStarter
        ? `ultra-simple minimalist beginner drawing template of ${baseTheme}, single clean continuous black outline on pure white background, basic geometric shapes, very few lines, large empty white spaces, easy to copy and trace by hand, children drawing book style, no shading, no gradients, no complex details, no texture, high contrast black line art`
        : `symmetrical circular mandala coloring book page inspired by ${baseTheme}, clean bold black ink outlines on pure white background, no shading, no gray, no color, simple closed regions for coloring, centered, minimalist line art`;
      if (env.GEMINI_API_KEY && !presetMap[pTopic]) {
        const gAsk = isStarter
          ? `Rewrite this idea into ONE very short English noun phrase (max 12 words) describing a super simple everyday object or nature scene easy for a beginner to trace by hand: "${topic}". Strictly wholesome, minimal shapes only. Return only the English phrase.`
          : `Rewrite this theme into ONE short neutral English geometric pattern phrase (max 25 words) for a circular mandala coloring book page: "${topic}". Strictly wholesome, abstract botanical or geometric motifs only, pure white background, crisp bold black ink outlines, no shading, no colors, no text. Return only the English prompt.`;
        const gOut = await Promise.race([
          callModel(env, [
            { role: "user", parts: [{ text: TASK_SYSTEM }] },
            { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
            { role: "user", parts: [{ text: gAsk }] },
          ], { temperature: 0.6, maxOutputTokens: 100 }),
          new Promise((r) => setTimeout(() => r({}), 5000)),
        ]);
        if (gOut && gOut.reply) {
          const clean = String(gOut.reply).split(/\n/)[0].replace(/^["“\s]+|["”\s]+$/g, "").slice(0, 200);
          if (clean.length >= 4) {
            imgPrompt = isStarter
              ? `ultra-simple minimalist beginner drawing template of ${clean}, single clean continuous black outline on pure white background, basic geometric shapes, very few lines, large empty white spaces, easy to copy and trace by hand, children drawing book style, no shading, no gradients, no complex details, no texture, high contrast black line art`
              : `${clean}, symmetrical circular mandala coloring book line art, pure white background, clean bold black outlines, no shading, no color, no text`;
          }
        }
      }
      try {
        let res;
        try {
          res = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: imgPrompt, steps: 4 });
        } catch (firstErr) {
          const msg = String(firstErr && firstErr.message || firstErr || "");
          if (/8007|nsfw|safety|flagged/i.test(msg)) {
            imgPrompt = safePrompt;
            res = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: safePrompt, steps: 4 });
          } else {
            throw firstErr;
          }
        }
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
      const audText = audienceHint(audience, lang);

      if (task === "art_questions") {
        const title = clip(body.title, 140);
        const note = clip(body.note, 140);
        if (isCrisis(title + " " + note)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);
        const modeName = ART_MODES[body.mode] || "vẽ";
        const b = mood(body.before), a = mood(body.after);
        const lines = [`Đối tượng: ${audText}`, `Phương pháp: ${modeName}.`];
        if (title) lines.push(`Tên bức vẽ: "${title}".`);
        if (b) lines.push(`Tâm trạng trước khi vẽ: ${b}/5.`);
        if (a) lines.push(`Tâm trạng sau khi vẽ: ${a}/5.`);
        if (note) lines.push(`Ghi chú: "${note}".`);
        const sp = body.spectrum && typeof body.spectrum === "object" ? body.spectrum : null;
        if (sp) {
          lines.push(`Phổ màu thực tế: gam dịu ${Number(sp.coolPct) || 0}%, gam ấm ${Number(sp.warmPct) || 0}%, gam trầm ${Number(sp.neutralPct) || 0}%, độ phủ ${Number(sp.coveragePct) || 0}%, thời gian ${Number(sp.durationSec) || 0} giây.`);
        }
        const askText = `Người dùng vừa hoàn thành bức tranh. ${lines.join(" ")}\nHãy viết:\n- Dòng 1: 1-2 câu quan sát trực quan ấm áp về màu sắc, đường nét hoặc hình khối thực tế trong bức tranh.\n- 3 dòng tiếp theo: đúng 3 câu hỏi mở ngắn, dịu dàng gắn với chi tiết hoặc màu sắc có thật trong bức tranh để người vẽ tự chiêm nghiệm cảm xúc.\nKhông chẩn đoán bệnh, không phán xét, không đánh số, không dùng ký hiệu markdown. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.`;
        let imgPart = null;
        if (typeof body.image === "string" && body.image.length < 260000) {
          const m = body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
          if (m && m[2].length < 250000) {
            imgPart = { inlineData: { mimeType: m[1], data: m[2] } };
          }
        }
        if (imgPart) {
          const outVis = await callModel(env, [
            { role: "user", parts: [{ text: TASK_SYSTEM }] },
            { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
            { role: "user", parts: [imgPart, { text: askText }] },
          ], { temperature: 0.7, maxOutputTokens: 340, _models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", env.MODEL_NAME || DEFAULT_MODEL] });
          if (outVis.reply) return json({ reply: outVis.reply, vision: true }, 200, cors);
        }
        const outTxt = await callModel(env, [
          { role: "user", parts: [{ text: TASK_SYSTEM }] },
          { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
          { role: "user", parts: [{ text: askText }] },
        ], { temperature: 0.7, maxOutputTokens: 320, _fast: true });
        if (outTxt.reply) return json({ reply: outTxt.reply, vision: false }, 200, cors);
        return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + outTxt.code + ")" }, 502, cors);
      }

      if (task === "explain_dass") {
        const d = Math.max(0, Math.min(42, Number(body.d) || 0));
        const a = Math.max(0, Math.min(42, Number(body.a) || 0));
        const s = Math.max(0, Math.min(42, Number(body.s) || 0));
        const hasPrev = body.prevD != null && body.prevA != null && body.prevS != null;
        const prevTxt = hasPrev ? `Lần trước: Trầm cảm ${Number(body.prevD) || 0}, Lo âu ${Number(body.prevA) || 0}, Căng thẳng ${Number(body.prevS) || 0}.` : "";
        const ask = `Nhóm đối tượng: ${audText}\nĐiểm tự đánh giá DASS hiện tại (thang 0-42): Trầm cảm ${d}, Lo âu ${a}, Căng thẳng ${s}. ${prevTxt}\nHãy viết một đoạn phân tích ấm áp (khoảng 75-100 từ) giải thích mối liên hệ giữa 3 chỉ số này${hasPrev ? " và nhận xét ngắn về sự thay đổi so với lần trước" : ""}, rồi gợi ý 1 bài tập thở ngắn và 1 hoạt động vẽ cụ thể phù hợp nhất. Luôn nhấn mạnh đây chỉ là kết quả tham khảo, không phải chẩn đoán y khoa. Không dùng ký hiệu markdown. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.`;
        const out = await callModel(env, [
          { role: "user", parts: [{ text: TASK_SYSTEM }] },
          { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
          { role: "user", parts: [{ text: ask }] },
        ], { temperature: 0.65, maxOutputTokens: 320 });
        if (out.reply) return json({ reply: out.reply }, 200, cors);
        return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + out.code + ")" }, 502, cors);
      }

      if (task === "weekly_insight") {
        const sess = (Array.isArray(body.sessions) ? body.sessions : []).slice(-10).map((x) => {
          const m = ART_MODES[x && x.mode] || (x && x.mode) || "vẽ";
          const bf = x && x.before ? x.before : "?";
          const af = x && x.after ? x.after : "?";
          const nt = clip(x && x.note, 60);
          return `${m} (tâm trạng ${bf}->${af}${nt ? ", ghi chú: " + nt : ""})`;
        });
        const dLogs = (Array.isArray(body.dassLogs) ? body.dassLogs : []).slice(-5).map((x) => `D:${Number(x && x.d) || 0}/A:${Number(x && x.a) || 0}/S:${Number(x && x.s) || 0}`);
        const ask = `Nhóm đối tượng: ${audText}\nCác phiên vẽ gần đây: ${sess.length ? sess.join("; ") : "chưa có"}.\nLịch sử DASS gần đây: ${dLogs.length ? dLogs.join(" -> ") : "chưa có"}.\nHãy viết bản tổng kết cá nhân hóa (90-120 từ) gồm đúng 3 dòng ngắn rõ ràng (mỗi dòng bắt đầu bằng nhãn không markdown):\n1. Xu hướng cảm xúc: ...\n2. Phương pháp hiệu quả nhất với bạn: ...\n3. Lời nhắn đồng hành: ...\nKhông chẩn đoán y khoa. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.`;
        const out = await callModel(env, [
          { role: "user", parts: [{ text: TASK_SYSTEM }] },
          { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
          { role: "user", parts: [{ text: ask }] },
        ], { temperature: 0.65, maxOutputTokens: 360 });
        if (out.reply) return json({ reply: out.reply }, 200, cors);
        return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + out.code + ")" }, 502, cors);
      }

      if (task === "cbt_reframe") {
        const thought = clip(body.thought, 220);
        if (!thought) return json({ error: lang === "en" ? "Please share a thought first." : "Bạn hãy viết suy nghĩ đang làm mình nặng lòng nhé." }, 400, cors);
        if (isCrisis(thought)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);
        const ask = `Nhóm đối tượng: ${audText}\nSuy nghĩ đang làm người dùng nặng lòng: "${thought}".\nHãy trả về ĐÚNG 3 phần ngắn gọn phân tách nhau bằng chuỗi " ||| " trên cùng 1 dòng (tuyệt đối không có lời dẫn, không đánh số, không markdown):\nPhần 1: 1-2 câu thấu cảm nhẹ nhàng và gọi tên thói quen suy nghĩ gây áp lực.\nPhần 2: 1-2 câu góc nhìn cân bằng mới thực tế, dịu dàng hơn.\nPhần 3: 1 đề bài vẽ 3 phút cụ thể, hình ảnh đơn giản giúp giải tỏa suy nghĩ đó (tối đa 22 từ).\nNgôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.`;
        const out = await callModel(env, [
          { role: "user", parts: [{ text: TASK_SYSTEM }] },
          { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
          { role: "user", parts: [{ text: ask }] },
        ], { temperature: 0.7, maxOutputTokens: 340 });
        if (out.reply) return json({ reply: out.reply }, 200, cors);
        return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + out.code + ")" }, 502, cors);
      }

      if (task === "ai_melody") {
        const theme = clip(body.theme, 100) || (lang === "en" ? "peaceful calm" : "bình yên dịu nhẹ");
        if (isCrisis(theme)) return json({ reply: CRISIS_REPLY[lang], crisis: true }, 200, cors);
        const ask = `Create a soothing pentatonic visual melody JSON for theme "${theme}". Return ONLY valid JSON with no markdown fences: {"bpm":64,"scale":"pentatonic","title":"short title","strokes":[{"colorIdx":0,"pts":[[0.08,0.6],[0.25,0.45],[0.42,0.52]]}]} with 6 to 8 smooth strokes, each stroke having 3 to 5 points with x in 0.05..0.95 (increasing left to right) and y in 0.15..0.85, colorIdx integer 0..7, bpm integer 56..76.`;
        const out = await callModel(env, [
          { role: "user", parts: [{ text: TASK_SYSTEM }] },
          { role: "model", parts: [{ text: "Understood." }] },
          { role: "user", parts: [{ text: ask }] },
        ], { temperature: 0.85, maxOutputTokens: 520 });
        if (out.reply) {
          const raw = out.reply.replace(/```json|```/gi, "").trim();
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              const parsed = JSON.parse(m[0]);
              if (parsed && Array.isArray(parsed.strokes) && parsed.strokes.length >= 3) {
                return json({ melody: parsed }, 200, cors);
              }
            } catch (_) {}
          }
        }
        return json({ error: "Fallback to local melody" }, 502, cors);
      }

      const seed = Number.isFinite(body.seed) ? Math.abs(Math.floor(body.seed)) % 100000 : 0;
      const ask = `Nhóm đối tượng: ${audText}\nHãy viết MỘT đề bài vẽ ngắn (tối đa 25 từ) để người dùng thư giãn và biểu đạt cảm xúc nhẹ nhàng. Đề bài tích cực hoặc trung tính, dễ thực hiện trong 5 đến 10 phút, không nhắc đến chấn thương, bệnh tật, cái chết hay tự làm đau. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}. Hãy sáng tạo khác mọi lần (mã ngẫu nhiên ${seed}). Chỉ trả về câu đề bài.`;
      const out = await callModel(env, [
        { role: "user", parts: [{ text: TASK_SYSTEM }] },
        { role: "model", parts: [{ text: "Mình hiểu và sẽ chỉ trả về nội dung được yêu cầu." }] },
        { role: "user", parts: [{ text: ask }] },
      ], { temperature: 0.95, maxOutputTokens: 200 });
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

    const ctxParts = [`Nhóm đối tượng: ${audienceHint(audience, lang)}`];
    if (body.context && typeof body.context === "object") {
      const c = body.context;
      if (c.dass && typeof c.dass === "object") {
        ctxParts.push(`Điểm DASS gần nhất (chỉ tham khảo): D=${Number(c.dass.d) || 0}, A=${Number(c.dass.a) || 0}, S=${Number(c.dass.s) || 0}.`);
      }
      if (typeof c.mood === "string" && c.mood) ctxParts.push(`Tâm trạng đang chọn: ${c.mood.slice(0, 40)}.`);
      if (typeof c.recentMode === "string" && ART_MODES[c.recentMode]) ctxParts.push(`Hoạt động vẽ hiện tại: ${ART_MODES[c.recentMode]}.`);
    }

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nNgữ cảnh ẩn danh hiện tại: " + ctxParts.join(" ") + (listen ? "\n\n" + LISTEN_PROMPT : "") + "\n\nHãy tuân thủ nghiêm ngặt các nguyên tắc trên." }] },
      { role: "model", parts: [{ text: "Mình hiểu rõ vai trò và sẽ tuân thủ các nguyên tắc này." }] },
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: message }] },
    ];

    const out = await callModel(env, contents, listen ? { temperature: 0.6, maxOutputTokens: 180 } : {});
    if (out.reply) return json({ reply: out.reply }, 200, cors);
    return json({ error: "Trợ lý đang bận, bạn thử lại sau nhé. (mã lỗi: " + out.code + ")" }, 502, cors);
  },
};

async function callModel(env, contents, override) {
  const ov = { ...(override || {}) };
  const customModels = Array.isArray(ov._models) ? ov._models : null;
  const isFast = !!ov._fast;
  delete ov._models;
  delete ov._fast;
  const model = env.MODEL_NAME || DEFAULT_MODEL;
  const fallback = env.FALLBACK_MODEL || DEFAULT_FALLBACK;
  const baseList = customModels || (isFast ? ["gemini-2.5-flash-lite", "gemini-2.5-flash", model, fallback] : ["gemini-2.5-flash-lite", model, "gemini-2.5-flash", fallback]);
  const models = [...new Set(baseList.filter(Boolean))];
  let lastCode = "network";
  const cfg = { temperature: 0.7, maxOutputTokens: 1024, ...ov };

  for (const m of models) {
    const isGemini = m.startsWith("gemini-");
    const reqCfg = isGemini ? cfg : { thinkingConfig: { thinkingLevel: "minimal" }, ...cfg };
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), 9000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents, generationConfig: reqCfg }),
        signal: ac.signal,
      });
      clearTimeout(tm);
      if (res.ok) {
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
        if (reply) return { reply };
        lastCode = "empty";
        continue;
      }
      const raw = (await res.text()).slice(0, 800);
      console.log("Upstream error", m, res.status, raw);
      lastCode = String(res.status);
      try { const e = JSON.parse(raw).error; if (e && e.status) lastCode += " " + e.status; } catch (_) {}
    } catch (err) {
      clearTimeout(tm);
      console.log("Worker error", m, String(err));
      lastCode = err && err.name === "AbortError" ? "timeout" : "network";
    }
  }
  return { code: lastCode };
}
