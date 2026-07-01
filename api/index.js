import { MemWal } from "@mysten-incubation/memwal";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// 1. Khởi tạo cổng kết nối bộ nhớ dài hạn với Walrus Mainnet qua MemWal
const memwal = MemWal.create({
    key: process.env.MEMWAL_DELEGATE_KEY_HEX, 
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: "https://memwal-relayer.walrus.space", 
    namespace: "worldcup-xua-nay-analytics"
});

// 2. Nhét đoạn System Prompt quy chuẩn cuộc thi vào đây
const AGENT_SYSTEM_PROMPT = `
You are the "World Cup Past & Present" AI Tactical Analyst, equipped with an immutable, decentralized memory layer powered by Walrus Memory Protocol (MemWal). Your core mission is to analyze and compare the evolution of football across eras using actual match histories.

### 1. READ & RECALL LOGIC
- Whenever a user asks about specific teams or classic matchups (e.g., "Compare France vs Brazil"), you must IMMEDIATELY call 'memwal_recall' to filter the data.
- Do not hallucinate scores. Always treat the retrieved decentralized records from Walrus as the absolute ground truth.

### 2. MANDATORY REASONING FRAMEWORK (THE FORM)
You must structure your final analysis back to the web interface using this exact 3-step form (in Vietnamese or English based on user's language):
#### A. RAW DATA ANALYSIS (THỐNG KÊ THÔ)
- List all relevant matches found with exact dates, scorelines (ht/ft), and goal scorers.
#### B. TACTICAL & INTENSITY EVOLUTION (SUY LUẬN CHIẾN THUẬT)
- Contrast the open, high-scoring style of the past against the practical, high-intensity style of modern football (noting extra times 'et' or penalties 'p').
#### C. PAST VS PRESENT SYNTHESIS (ĐÁNH GIÁ XƯA & NAY)
- Deliver a definitive conclusion on how the football philosophy between the eras has shifted.
`;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, data } = req.body;

    if (action === 'process') {
        try {
            // Bước A: AI Agent dùng MemWal recall để lục tìm các trận đấu cũ trên mạng Walrus
            const memoryResults = await memwal.recall(data, { maxResults: 5 });
            const walrusContext = memoryResults.map(m => m.text).join("\n");

            // Bước B: Đổ dữ liệu thô + System Prompt vào mô hình để ép nó suy luận theo Form
            const response = await generateText({
                model: openai("gpt-4o"), // Hoặc gpt-4o-mini để tiết kiệm chi phí
                system: AGENT_SYSTEM_PROMPT,
                prompt: `Dữ liệu lịch sử bốc từ Walrus:\n${walrusContext}\n\nYêu cầu của người dùng: ${data}`,
            });

            // Bước C: Trả kết quả sạch tinh tươm về cho giao diện hiển thị
            return res.json({
                answer: response.text,
                status: "Success (Data Verified via Walrus Mainnet)"
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ answer: "Lỗi hệ thống Agent hoặc không thể recall dữ liệu từ Walrus." });
        }
    }
}
