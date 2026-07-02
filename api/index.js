import { MemWal } from "@mysten-incubation/memwal";

// Khởi tạo kết nối bộ nhớ Walrus Mainnet chuẩn xác với dự án của bạn
const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "walrus-ss-5"
});

// Cấu hình Prompt hệ thống cho kết quả đầu ra theo ngôn ngữ lựa chọn
const getSystemPrompt = (lang) => {
    if (lang === 'en') {
        return `You are the "World Cup Past & Present" AI Tactical Analyst, powered by Walrus Memory (MemWal).
CRITICAL RULE: You MUST reply entirely in ENGLISH. DO NOT use Vietnamese.
Analyze using strict 3-step form:
1. RAW DATA ANALYSIS
2. TACTICAL & INTENSITY EVOLUTION
3. PAST VS PRESENT SYNTHESIS`;
    }
    return `You are the "World Cup Past & Present" AI Tactical Analyst, powered by Walrus Memory (MemWal).
QUY TẮC BẮT BUỘC: Bạn PHẢI trả lời hoàn toàn bằng TIẾNG VIỆT.
Analyze using strict 3-step form:
1. RAW DATA ANALYSIS (THỐNG KÊ THÔ)
2. TACTICAL & INTENSITY EVOLUTION (SUY LUẬN CHIẾN THUẬT)
3. PAST VS PRESENT SYNTHESIS (ĐÁNH GIÁ XƯA & NAY)`;
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

            // 3. TỰ ĐỘNG GHI CÂU HỎI MỚI THÀNH MỘT BLOB TRÊN WALRUS MAINNET (Tăng tiến số lượng Blob thực tế)
            let newBlobId = "N/A";
            try {
                console.log(`🚀 Tiến hành ghi nhận Blob mới on-chain cho câu hỏi: "${data}"...`);
                const job = await memwal.remember(`User asked about ${englishQuery}: ${data}`);
                newBlobId = job.job_id || job.id || "Success";
            } catch (writeErr) {
                console.error("⚠️ Lỗi ghi Blob tự động:", writeErr.message);
            }

            // 4. Kết xuất bài phân tích chiến thuật 3 bước qua cổng Llama 3.1
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
                // Trả kết quả phân tích kèm mã định danh Blob mới vừa đúc về cho giao diện web
                return res.json({ answer: answerText, status: "Success", blobId: newBlobId });
            } else {
                throw new Error(groqData.error?.message || "Lỗi không xác định từ Groq");
            }
        } catch (error) {
            console.error("❌ Lỗi hệ thống:", error);
            return res.status(500).json({ answer: "Lỗi hệ thống: " + error.message });
        }
    }

    // Trả về lỗi nếu gọi sai hành động
    return res.status(400).json({ error: 'Invalid action' });
}
