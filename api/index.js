import { MemWal } from "@mysten-incubation/memwal";
import { GoogleGenAI } from "@google/genai";

const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "worldcup-xua-nay-analytics"
});

// Khởi tạo SDK Google
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const AGENT_SYSTEM_PROMPT = `
You are the "World Cup Past & Present" AI Tactical Analyst, powered by Walrus Memory (MemWal).
Analyze historical football matchups using strict 3-step form:
1. RAW DATA ANALYSIS (THỐNG KÊ THÔ)
2. TACTICAL & INTENSITY EVOLUTION (SUY LUẬN CHIẾN THUẬT)
3. PAST VS PRESENT SYNTHESIS (ĐÁNH GIÁ XƯA & NAY)
`;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, data } = req.body;

    if (action === 'process') {
        try {
            console.log(`🔍 Tiến hành recall từ khóa: ${data}`);
            const memoryResults = await memwal.recall(data, { maxResults: 5 }); 
            const walrusContext = memoryResults && memoryResults.length > 0 
                ? memoryResults.map(m => m.text).join("\n")
                : "Không tìm thấy dữ liệu trực tiếp trong bộ nhớ Walrus.";

            console.log("🤖 Đang gửi dữ liệu bối cảnh qua cấu trúc Google GenAI mới...");
            
            // ĐÃ SỬA: Đổi tên model thành 'gemini-2.5-flash' hoặc 'gemini-1.5-flash' kèm tiền tố chuẩn của hệ thống SDK mới
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Sử dụng dòng mô hình chuẩn hóa thế hệ mới nhất chạy cực bốc cho SDK này
                contents: `Dữ liệu bối cảnh lịch sử rút từ Walrus Mainnet:\n${walrusContext}\n\nYêu cầu phân tích từ người dùng: ${data}`,
                config: {
                    systemInstruction: AGENT_SYSTEM_PROMPT,
                    temperature: 0.3
                }
            });

            return res.json({ answer: response.text, status: "Success" });
        } catch (error) {
            console.error("❌ Lỗi:", error);
            return res.status(500).json({ answer: "Lỗi hệ thống: " + error.message });
        }
    }

    if (action === 'seed_data_xyz') {
        try {
            const sampleData1930 = "Lịch sử World Cup 1930 diễn ra tại Uruguay. Uruguay vô địch sau khi thắng Argentina 4-2 ở chung kết. Brazil bị loại từ vòng bảng, chỉ ghi được 5 bàn thắng (thắng Bolivia 4-0 và thua Yugoslavia 1-2). Cầu thủ Guillermo Stábile của Argentina là vua phá lưới với 8 bàn.";
            const job = await memwal.remember(sampleData1930);
            return res.json({ success: true, job_id: job.job_id || job.id });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

    if (action === 'seed_data_xyz') {
        try {
            const sampleData1930 = "Lịch sử World Cup 1930 diễn ra tại Uruguay. Uruguay vô địch sau khi thắng Argentina 4-2 ở chung kết. Brazil bị loại từ vòng bảng, chỉ ghi được 5 bàn thắng (thắng Bolivia 4-0 và thua Yugoslavia 1-2). Cầu thủ Guillermo Stábile của Argentina là vua phá lưới với 8 bàn.";
            const job = await memwal.remember(sampleData1930);
            return res.json({ success: true, job_id: job.job_id || job.id });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}
