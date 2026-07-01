import { MemWal } from "@mysten-incubation/memwal";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

// Khởi tạo kết nối MemWal đồng bộ thông số cấu hình từ Vercel Env
const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "worldcup-xua-nay-analytics"
});

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

    // 1. XỬ LÝ TÌM KIẾM CHO TRANG WEB (ĐÃ SỬA LỖI 422 INVALID TYPE)
    if (action === 'process') {
        try {
            console.log(`🔍 Tiến hành recall bộ nhớ Walrus với từ khóa chuỗi: ${data}`);
            
            // HOÀN HẢO: Truyền thẳng chuỗi string 'data' để khớp định dạng đầu vào của Walrus
            const memoryResults = await memwal.recall(data, { maxResults: 5 }); 
            
            const walrusContext = memoryResults && memoryResults.length > 0 
                ? memoryResults.map(m => m.text).join("\n")
                : "Không tìm thấy dữ liệu trực tiếp trong bộ nhớ Walrus.";

            console.log("🤖 Đang gửi dữ liệu bối cảnh qua cho Gemini xử lý...");
            const response = await generateText({
                model: google("gemini-1.5-flash"), 
                system: AGENT_SYSTEM_PROMPT,
                prompt: `Dữ liệu bối cảnh lịch sử rút từ Walrus Mainnet:\n${walrusContext}\n\nYêu cầu phân tích từ người dùng: ${data}`,
            });

            return res.json({ answer: response.text, status: "Success" });
        } catch (error) {
            console.error("❌ Lỗi Recall hoặc Gemini:", error);
            return res.status(500).json({ answer: "Hệ thống đang đồng bộ hoặc gặp lỗi truy xuất: " + error.message });
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
