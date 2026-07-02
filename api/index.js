import { MemWal } from "@mysten-incubation/memwal";

// Khởi tạo kết nối bộ nhớ Walrus Mainnet
const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "walrus-ss-5"
});

// Cấu hình Prompt hệ thống (phiên bản tối ưu cho cuộc thi)
const getSystemPrompt = (lang) => {
    const basePrompt = `You are "World Cup Xưa & Nay" – a world-class Tactical Football Historian & Analyst powered by Walrus Memory (MemWal).

Core Identity:
- You possess deep, evolving knowledge of World Cup history, tactics, player/team evolution, and match patterns.
- You think like a combination of a top coach, data analyst, and football historian.

Mandatory 3-Step Reasoning Framework (always follow this structure):
1. RAW DATA ANALYSIS (THỐNG KÊ THÔ)
   - Retrieve and summarize relevant historical data from Walrus Memory.
2. TACTICAL & INTENSITY EVOLUTION (SUY LUẬN CHIẾN THUẬT)
   - Analyze how tactics, intensity, formations, playing styles, and key moments have evolved over time.
3. PAST VS PRESENT SYNTHESIS (ĐÁNH GIÁ XƯA & NAY)
   - Deliver sharp, insightful comparison between past and present, highlighting key changes, lessons, and modern implications.

Walrus Memory Protocol (Strict & Intelligent):
- Before every response: Always call recall() using the main topic, country, team, player, or keyword (in English) to fetch the most relevant historical context.
- After generating the answer: Evaluate whether the current query or your analysis contains durable, high-value knowledge (tactical insights, evolution patterns, unique historical observations, player/team development arcs). 
  - If YES → call remember() with a concise, structured summary in this format: [Topic] | [Key Insight] | [Historical Context] | [Period]
  - If NO (temporary question, casual chat, low-value info) → do NOT remember.
- Only store information that will genuinely improve future analyses.

Output Rules:
- Always use clear section headings for the 3 steps.
- Be insightful, data-driven, and tactically sharp.
- Use markdown for readability (tables, bullet points when helpful).`;

    if (lang === 'en') {
        return basePrompt + `\n\nCRITICAL RULE: You MUST reply entirely in ENGLISH. DO NOT use Vietnamese.`;
    }
    
    return basePrompt + `\n\nQUY TẮC BẮT BUỘC: Bạn PHẢI trả lời hoàn toàn bằng TIẾNG VIỆT.`;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, data, lang } = req.body;
    const currentLang = lang || 'vi';

    // XỬ LÝ TRUY VẤN VÀ TỰ ĐỘNG TẠO BLOB REAL-TIME
    if (action === 'process') {
        try {
            console.log(`Query gốc nhận được: ${data}`);

            // 1. Trích xuất duy nhất tên quốc gia bằng tiếng Anh để tối ưu hóa khả năng tìm kiếm của Walrus
            const translationResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: "You are a keyword extractor. Extract ONLY the main country name in English from the football query. Output ONLY the single country name. No punctuation." },
                        { role: "user", content: data }
                    ],
                    temperature: 0.1
                })
            });

            const translationData = await translationResponse.json();
            const englishQuery = translationData.choices?.[0]?.message?.content?.trim() || data;
            console.log(`🔍 Từ khóa quét Walrus: ${englishQuery}`);

            // 2. Thực hiện Recall lấy bối cảnh dữ liệu lịch sử từ bộ nhớ Walrus
            let walrusContext = "";
            try {
                const memoryResults = await memwal.recall(englishQuery, { maxResults: 5 }); 
                if (memoryResults && memoryResults.length > 0) {
                    walrusContext = memoryResults.map(m => m.text).join("\n");
                }
            } catch (err) {
                console.error("⚠️ Lỗi recall:", err.message);
            }

            // 3. TỰ ĐỘNG GHI CÂU HỎI MỚI THÀNH MỘT BLOB TRÊN WALRUS MAINNET
            let newBlobId = "N/A";
            try {
                console.log(`🚀 Tiến hành ghi nhận Blob mới on-chain cho câu hỏi: "${data}"...`);
                const job = await memwal.remember(`User asked about ${englishQuery}: ${data}`);
                newBlobId = job.job_id || job.id || "Success";
            } catch (writeErr) {
                console.error("⚠️ Lỗi ghi Blob tự động:", writeErr.message);
            }

            // 4. Kết xuất bài phân tích chiến thuật 3 bước
            const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: getSystemPrompt(currentLang) },
                        { role: "user", content: `Dữ liệu từ bộ nhớ Walrus:\n${walrusContext}\n\nYêu cầu phân tích: ${data}` }
                    ],
                    temperature: 0.2
                })
            });

            const groqData = await groqResponse.json();
            
            if (groqData.choices && groqData.choices[0]) {
                const answerText = groqData.choices[0].message.content;
                return res.json({ answer: answerText, status: "Success", blobId: newBlobId });
            } else {
                throw new Error(groqData.error?.message || "Lỗi không xác định từ Groq");
            }
        } catch (error) {
            console.error("❌ Lỗi hệ thống:", error);
            return res.status(500).json({ answer: "Lỗi hệ thống: " + error.message });
        }
    }

    return res.status(400).json({ error: 'Invalid action' });
}
