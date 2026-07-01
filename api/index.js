import { MemWal } from "@mysten-incubation/memwal";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://relayer.memory.walrus.xyz", 
    namespace: "worldcup-xua-nay-analytics"
});

const AGENT_SYSTEM_PROMPT = `You are the "World Cup Past & Present" AI Tactical Analyst. Analyze historical football matchups using a 3-step form.`;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, data } = req.body;

    // 1. XỬ LÝ TÌM KIẾM CHO TRANG WEB
    if (action === 'process') {
        try {
            const memoryResults = await memwal.recall(data, { maxResults: 5 });
            const walrusContext = memoryResults.map(m => m.text).join("\n");

            const response = await generateText({
                model: google("gemini-1.5-flash"), 
                system: AGENT_SYSTEM_PROMPT,
                prompt: `Dữ liệu từ Walrus:\n${walrusContext}\n\nYêu cầu: ${data}`,
            });

            return res.json({ answer: response.text });
        } catch (error) {
            return res.status(500).json({ answer: "Hệ thống đang đồng bộ dữ liệu Walrus, vui lòng thử lại sau." });
        }
    }

    // 2. KÍCH HOẠT BƠM MỒI DATA 1930 TRỰC TIẾP KHÔNG CẦN ĐỌC FILE
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
