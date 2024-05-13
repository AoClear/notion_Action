require("dotenv").config();
const { Client } = require('@notionhq/client');

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

    // 현재 날짜를 가져옵니다.
    const currentDate = new Date();
    // 현재 연도와 월을 가져옵니다.
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript의 getMonth()는 0부터 시작하므로 1을 더해줍니다.

    // 사용자별로 "상태" 속성의 "완료"값의 갯수를 계산합니다.
    const processingStatusByUser = {};
    response.results.forEach((page) => {
        // 담당자 속성이 존재하는지 확인합니다.
        if (page.properties.담당자) {
            // 담당자가 있는 경우에만 처리합니다.
            const userId = page.properties.담당자.people[0]?.id;
            if (userId) {
                if (!processingStatusByUser[userId]) {
                    processingStatusByUser[userId] = 0;
                }
                // "상태" 속성이 '완료'이고, "완료일" 속성이 현재 연도와 월에 속하는 경우에만 처리합니다.
                if (page.properties.상태.select.name === '완료' && page.properties.완료일.date.start.includes(`${currentYear}-${currentMonth}`)) {
                    processingStatusByUser[userId]++;
                }
            }   
        }
    });

        // 사용자별 처리완료건수를 내림차순으로 정렬합니다.
        const sortedProcessingStatusByUser = Object.entries(processingStatusByUser)
            .sort(([, countA], [, countB]) => countA - countB)
            .reduce((acc, [userId, count]) => {
                acc[userId] = count;
                return acc;
            }, {});

        // "사원별 처리완료 건" 데이터베이스를 전부 삭제합니다.
        const pagesResponse = await notion.databases.query({
            database_id: processingStatusDatabaseId,
        });
        for (const page of pagesResponse.results) {
            await notion.pages.update({
                page_id: page.id,
                archived: true, // 페이지를 보관 상태로 변경하여 삭제합니다.
            });
        }

        // 새로운 값으로 "사원별 처리완료 건" 데이터베이스를 업데이트합니다.
        for (const userId in sortedProcessingStatusByUser) {
            await notion.pages.create({
                parent: { database_id: processingStatusDatabaseId },
                properties: {
                    사원: { people: [{ id: userId }] },
                    처리완료건수: { number: sortedProcessingStatusByUser[userId] },
                },
            });
        }

        console.log('Processing status updated successfully.');
    } catch (error) {
        console.error('Error updating processing status:', error);
    }
}

async function run() {
    try {
        await updateProcessingStatus();
        console.log('Processing status run successfully.');
    } catch (error) {
        console.error('Error updating run status:', error);
    }
}
  
run();