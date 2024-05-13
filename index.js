const express = require('express');
const { Client } = require('@notionhq/client');

const app = express();
const port = 3000;

// Notion API를 초기화합니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// "헬프데스크" 데이터베이스의 ID
const helpdeskDatabaseId = process.env.HELPDESK_DATABASE_ID;

// "사원별 처리완료 건" 데이터베이스의 ID
const processingStatusDatabaseId = process.env.PROCESSING_STATUS_DATABASE_ID;

// 사용자별로 "상태" 속성의 "완료"값의 갯수를 가져와서 "사원별 처리완료 건" 데이터베이스에 자동으로 기입하는 함수
async function updateProcessingStatus() {
    try {
        // "헬프데스크" 데이터베이스에서 필요한 정보를 가져옵니다.
        const response = await notion.databases.query({
            database_id: helpdeskDatabaseId,
        });

        // 사용자별로 "상태" 속성의 "완료"값의 갯수를 계산합니다.
        const processingStatusByUser = {};
        response.results.forEach((page) => {
            const userId = page.properties.담당자.people[0].id;
            if (!processingStatusByUser[userId]) {
                processingStatusByUser[userId] = 0;
            }
            if (page.properties.상태.select.name === '완료') {
                processingStatusByUser[userId]++;
            }
        });

        // "사원별 처리완료 건" 데이터베이스를 업데이트합니다.
        for (const userId in processingStatusByUser) {
            await notion.pages.create({
                parent: { database_id: processingStatusDatabaseId },
                properties: {
                    사원: { people: [{ id: userId }] },
                    처리완료건수: { number: processingStatusByUser[userId] },
                },
            });
        }

        console.log('Processing status updated successfully.');
    } catch (error) {
        console.error('Error updating processing status:', error);
    }
}

// "프로세스 상태 업데이트"를 위한 엔드포인트를 정의합니다.
app.get('/update-processing-status', async (req, res) => {
    // 처리 완료 상태를 업데이트합니다.
    await updateProcessingStatus();
    res.send('Processing status update initiated.');
});

// 미들웨어를 등록합니다.
app.use(express.json());

// 서버를 시작합니다.
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
