import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "worldcup-xua-nay-analytics"
});

// Cấu hình Prompt hệ thống cho kết quả đầu ra
const getSystemPrompt = (lang) => {
    if (lang === 'en') {
        return `You are the "World Cup Past & Present" AI Tactical Analyst, powered by Walrus Memory (MemWal).
CRITICAL RULE: You MUST reply entirely in ENGLISH. DO NOT use Vietnamese.

You MUST strictly follow this 3-step English template for your output formatting:
1. RAW DATA ANALYSIS
- Provide raw statistics, match details, and core historical facts retrieved.

2. TACTICAL & INTENSITY EVOLUTION
- Analyze how tactics, formations, and physical intensity have changed over time.

3. PAST VS PRESENT SYNTHESIS
- Synthesize the comparison between football eras and provide a final conclusion.`;
    }
    
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

    if (action === 'process') {
        try {
            console.log(`原 Query nhận từ giao diện: ${data}`);

            // Bước 1: Gọi một lệnh fetch siêu nhanh sang Groq để chuẩn hóa/dịch query sang Tiếng Anh chuyên ngành bóng đá
            console.log("🤖 Đang chuẩn hóa và dịch từ khóa sang tiếng Anh để tối ưu tìm kiếm Walrus...");
            const translationResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { 
                            role: "system", 
                            content: "You are a translation utility. Translate the user's football-related query into a concise English search keyword or phrase (e.g., 'đội pháp' -> 'France national football team', 'ý' -> 'Italy'). Output ONLY the plain text translation. No explanations, no quotes." 
                        },
                        { role: "user", content: data }
                    ],
                    temperature: 0.1
                })
            });

            const translationData = await translationResponse.json();
            // Lấy từ khóa đã được dịch sang tiếng Anh (Nếu gõ "đội pháp", englishQuery sẽ thành "France national football team")
            const englishQuery = translationData.choices?.[0]?.message?.content?.trim() || data;
            console.log(`🔍 Từ khóa thực tế dùng để truy vấn Walrus: ${englishQuery}`);

            // Bước 2: Dùng từ khóa tiếng Anh chuẩn để recall dữ liệu từ Walrus Mainnet
            const memoryResults = await memwal.recall(englishQuery, { maxResults: 5 }); 
            const walrusContext = memoryResults && memoryResults.length > 0 
                ? memoryResults.map(m => m.text).join("\n")
                : (currentLang === 'en' ? "No direct data found in Walrus memory." : "Không tìm thấy dữ liệu trực tiếp trong bộ nhớ Walrus.");

            // Bước 3: Đẩy bối cảnh tìm được qua Llama 3.1 để kết xuất bài phân tích theo ngôn ngữ người dùng lựa chọn
            console.log("🤖 Đang tạo bài phân tích 3 bước...");
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
                            content: `Walrus Mainnet Historical Context Data:\n${walrusContext}\n\nUser Analysis Request: ${data}`
                        }
                    ],
                    temperature: 0.2
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
