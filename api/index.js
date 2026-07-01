import { MemWal } from "@mysten-incubation/memwal";
import { GoogleGenAI } from "@google/genai";

// Khởi tạo kết nối bộ nhớ Walrus Mainnet
const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "worldcup-xua-nay-analytics"
});

// Khởi tạo bộ não Google AI thế hệ mới (Hỗ trợ hoàn hảo đặc tả v2)
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

    // 1. XỬ LÝ TÌM KIẾM CHO TRANG WEB (FIX TRIỆT ĐỂ LỖI UNSUPPORTED MODEL VERSION)
    if (action === 'process') {
        try {
            console.log(`🔍 Tiến hành recall bộ nhớ Walrus với từ khóa chuỗi: ${data}`);
            
            // Gọi lệnh tìm kiếm dữ liệu trên Walrus
            const memoryResults = await memwal.recall(data, { maxResults: 5 }); 
            
            const walrusContext = memoryResults && memoryResults.length > 0 
                ? memoryResults.map(m => m.text).join("\n")
                : "Không tìm thấy dữ liệu trực tiếp trong bộ nhớ Walrus.";

            console.log("🤖 Đang gửi dữ liệu bối cảnh qua cấu trúc Google GenAI mới...");
            
            // Sử dụng hàm gọi trực tiếp từ SDK chính thức của Google để tránh lỗi cấu trúc của AI SDK
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: `Dữ liệu bối cảnh lịch sử rút từ Walrus Mainnet:\n${walrusContext}\n\nYêu cầu phân tích từ người dùng: ${data}`,
                config: {
                    systemInstruction: AGENT_SYSTEM_PROMPT,
                    temperature: 0.3
                }
            });

            return res.json({ answer: response.text, status: "Success" });
        } catch (error) {
            console.error("❌ Lỗi Recall hoặc Gemini:", error);
            return res.status(500).json({ answer: "Hệ thống trục trặc kết nối: " + error.message });
        }
    }

    // 2. KÍCH HOẠT BƠM MỒI DATA 1930
    if (action === 'seed_data_xyz') {
        try {
            const sampleData1930 = "Lịch sử World Cup 1930 diễn ra tại Uruguay. Uruguay vô địch sau khi thắng Argentina 4-2 ở chung kết. Brazil bị loại từ vòng bảng, chỉ ghi được 5 bàn thắng (thắng Bolivia 4-0 và thua Yugoslavia 1-2). Cầu thủ Guillermo Stábile của Argentina là vua phá lưới với 8 bàn.";

            console.log("🚀 Đang nạp mồi dữ liệu lên Walrus Mainnet...");
            const job = await memwal.remember(sampleData1930);
            
            return res.json({ 
                success: true, 
                message: "Đã gửi dữ liệu mồi World Cup 1930 lên hàng đợi Walrus!",
                job_id: job.job_id || job.id
            });
        } catch (error) {
            return res.status(500).json({ error: "Lỗi Seeding: " + error.message });
        }
    }
}
