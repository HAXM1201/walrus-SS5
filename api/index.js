import { MemWal } from "@mysten-incubation/memwal";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import fs from "fs";
import path from "path";

// Khởi tạo kết nối MemWal dùng chung
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

    // CHỨC NĂNG 1: TÌM KIẾM TRÊN WEB (DÙNG RECALL)
    if (action === 'process') {
        try {
            const memoryResults = await memwal.recall(data, { maxResults: 5 });
            const walrusContext = memoryResults.map(m => m.text).join("\n");

            const response = await generateText({
                model: google("gemini-1.5-flash"), 
                system: AGENT_SYSTEM_PROMPT,
                prompt: `Dữ liệu lịch sử bốc từ Walrus:\n${walrusContext}\n\nYêu cầu của người dùng: ${data}`,
            });

            return res.json({ answer: response.text, status: "Success (Data Verified via Walrus Mainnet)" });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ answer: "Đang nạp dữ liệu lên hệ thống, vui lòng thử lại sau vài phút." });
        }
    }

    // CHỨC NĂNG 2: BƠM DỮ LIỆU MỒI TRÊN ĐÁM MÂY VERCEL (NÉ LỖI LOCAL FETCH FAILED)
    if (action === 'seed_data_xyz') {
        try {
            // Đọc file data.json nằm cùng cấp thư mục gốc trên Vercel
            const filePath = path.join(process.cwd(), 'data.json');
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: "Không tìm thấy file data.json trên Repo GitHub." });
            }

            const rawFile = fs.readFileSync(filePath, "utf-8");
            const jsonData = JSON.parse(rawFile);
            const history = jsonData.history;
            let count = 0;

            console.log("🚀 Bắt đầu tiến trình Seeding trên đám mây Vercel...");

            for (const year in history) {
                const yearData = history[year];
                const contextText = `Lịch sử giải đấu ${yearData.name}: Các trận đấu, tỷ số hiệp 1 (ht), cả trận (ft), cầu thủ ghi bàn bao gồm: ${JSON.stringify(yearData.matches)}`;

                // Tạo lệnh ghi nhớ
                const job = await memwal.remember(contextText);
                // Chờ Walrus xác thực hoàn tất job
                await memwal.waitForRememberJob(job.job_id || job.id);
                
                count++;
                if (count >= 11) break; // Chỉ cần nạp 11 năm để lấy đủ số blob count đi thi
            }

            return res.json({ success: true, message: `Đã nạp thành công ${count} Blobs lên Walrus Mainnet từ mây Vercel!` });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Lỗi trong quá trình seeding: " + error.message });
        }
    }
}
