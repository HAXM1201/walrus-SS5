import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "worldcup-xua-nay-analytics"
});

// Cấu hình Prompt tăng cường ép buộc ngôn ngữ tuyệt đối cho Llama 3.1
const getSystemPrompt = (lang) => {
    if (lang === 'en') {
        return `You are the "World Cup Past & Present" AI Tactical Analyst, powered by Walrus Memory (MemWal).

CRITICAL RULE: You MUST reply entirely in ENGLISH. DO NOT use Vietnamese in your response, even if the provided context data or user query is in Vietnamese. Translate any Vietnamese context into English automatically.

You MUST strictly follow this 3-step English template for your output formatting:
1. RAW DATA ANALYSIS
- Provide raw statistics, match details, and core historical facts retrieved.

2. TACTICAL & INTENSITY EVOLUTION
- Analyze how tactics, formations, and physical intensity have changed over time.

3. PAST VS PRESENT SYNTHESIS
- Synthesize the comparison between football eras and provide a final conclusion.`;
    }
    
    // Mặc định trả về Tiếng Việt
    return `You are the "World Cup Past & Present" AI Tactical Analyst, powered by Walrus Memory (MemWal).

QUY TẮC BẮT BUỘC: Bạn PHẢI trả lời hoàn toàn bằng TIẾNG VIỆT. 

Bạn PHẢI tuân thủ nghiêm ngặt cấu trúc định dạng 3 bước sau đây cho câu trả lời:
1. RAW DATA ANALYSIS (THỐNG KÊ THÔ)
- Cung cấp các số liệu thống kê thô, chi tiết trận đấu và sự thật lịch sử cốt lõi lấy được.

2. TACTICAL & INTENSITY EVOLUTION (SUY LUẬN CHIẾN THUẬT)
- Phân tích sự thay đổi về chiến thuật, sơ đồ đội hình và cường độ thể chất theo thời gian.

3. PAST VS PRESENT SYNTHESIS (ĐÁNH GIÁ XƯA & NAY)
- Tổng hợp so sánh giữa các kỷ nguyên bóng đá và đưa ra kết luận cuối cùng.`;
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, data, lang } = req.body;
    const currentLang = lang || 'vi';

    // 1. XỬ LÝ TÌM KIẾM VÀ PHÂN TÍCH
    if (action === 'process') {
        try {
            console.log(`🔍 Tiến hành recall từ khóa: ${data} [Ngôn ngữ: ${currentLang}]`);
            const memoryResults = await memwal.recall(data, { maxResults: 5 }); 
            const walrusContext = memoryResults && memoryResults.length > 0 
                ? memoryResults.map(m => m.text).join("\n")
                : (currentLang === 'en' ? "No direct data found in Walrus memory." : "Không tìm thấy dữ liệu trực tiếp trong bộ nhớ Walrus.");

            console.log("🤖 Đang gửi dữ liệu bối cảnh qua API Groq (Llama 3.1) với Prompt ép ngôn ngữ...");
            
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
                        { 
                            role: "user", 
                            content: currentLang === 'en'
                                ? `Walrus Mainnet Historical Context Data (Translate this into English analysis if it is in Vietnamese):\n${walrusContext}\n\nUser Analysis Request: ${data}`
                                : `Dữ liệu bối cảnh lịch sử rút từ Walrus Mainnet:\n${walrusContext}\n\nYêu cầu phân tích từ người dùng: ${data}`
                        }
                    ],
                    temperature: 0.2 // Giảm xuống 0.2 để AI tuân thủ cấu trúc hệ thống chặt chẽ hơn, không tự sáng tạo ngôn ngữ
                })
            });

            const groqData = await groqResponse.json();
            
            if (groqData.choices && groqData.choices[0]) {
                const answerText = groqData.choices[0].message.content;
                return res.json({ answer: answerText, status: "Success" });
            } else {
                throw new Error(groqData.error?.message || "Lỗi không xác định từ Groq API");
            }
        } catch (error) {
            console.error("❌ Lỗi hệ thống:", error);
            return res.status(500).json({ answer: (currentLang === 'en' ? "System error: " : "Lỗi hệ thống: ") + error.message });
        }
    }

    // 2. KÍCH HOẠT BƠM MỒI DATA 1930
    if (action === 'seed_data_xyz') {
        try {
            const sampleData1930 = "Lịch sử World Cup 1930 diễn ra tại Uruguay. Uruguay vô địch sau khi thắng Argentina 4-2 ở chung kết. Brazil bị loại từ vòng bảng, chỉ ghi được 5 bàn thắng (thắng Bolivia 4-0 và thua Yugoslavia 1-2). Cầu thủ Guillermo Stábile của Argentina là vua phá lưới với 8 bàn.";
            console.log("🚀 Đang nạp mồi dữ liệu lên Walrus Mainnet...");
            const job = await memwal.remember(sampleData1930);
            return res.json({ success: true, job_id: job.job_id || job.id });
        } catch (error) {
            console.error("❌ Lỗi Seeding:", error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(400).json({ error: 'Invalid action' });
}
