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
        // "헬프데스크" 데이터베이스에서 행 정보를 가져옵니다.
        const helpDeskResponse = await notion.databases.query({
            database_id: helpdeskDatabaseId,
        });

         // "사원별 처리완료 건" 데이터베이스에서 행 정보를 가져옵니다.
        const processingStatusResponse = await notion.databases.query({
            database_id: processingStatusDatabaseId,
        });

        // 데이터베이스의 메타데이터를 쿼리하여 가져옵니다.
        const processingStatusInfo = await notion.databases.retrieve({ database_id: processingStatusDatabaseId });

        // 현재 날짜를 가져옵니다.
        const currentDate = new Date();
        // 현재 연도와 월을 가져옵니다.
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // JavaScript의 getMonth()는 0부터 시작하므로 1을 더해줍니다.

        // "사원별 처리완료 건" 데이터베이스의 제목을 이번 달에 맞게 수정합니다.
        if(!processingStatusInfo.title[0].plain_text.includes(currentMonth))
        {
            await notion.databases.update({
                database_id: processingStatusDatabaseId,
                title: [
                    {
                        type: 'text',
                        text: {
                            content: currentMonth + "월 사원별 처리완료 건",
                        },
                    },
                ],
            });
        }

        // 사용자별로 "상태" 속성의 "완료"값의 갯수를 계산합니다.
        const totalProcessingStatusByUser = {}; //누적 '완료'값의 갯수
        const processingStatusByUserInMonth = {};   //이번달 '완료'값의 갯수
        helpDeskResponse.results.forEach((page) => {
                // 담당자가 있는 경우에만 처리합니다.
                const userId = page.properties.담당자.people[0]?.id;
                if (userId) {
                    if (!totalProcessingStatusByUser[userId]) {
                        totalProcessingStatusByUser[userId] = 0;
                        processingStatusByUserInMonth[userId] = 0;
                    }
                    
                    // completionDate가 유효한 경우에만 처리를 진행합니다.
                    const completionDate = page.properties.완료일.date?.start ? new Date(page.properties.완료일.date.start) : null;
                    if (!completionDate) {
                        return; // 날짜가 null이거나 유효하지 않은 경우 함수 실행 종료
                    }
                    // "상태" 속성이 '완료'이고, "완료일" 속성이 현재 연도와 월에 속하는 경우에만 처리합니다.
                    const parsedCompletionDate = new Date(completionDate);
                    const completionYear = parsedCompletionDate.getFullYear();
                    const completionMonth = parsedCompletionDate.getMonth() + 1;
                    if (page.properties.상태.select.name === '완료') {
                        totalProcessingStatusByUser[userId]++;
                        if(completionYear === currentYear && completionMonth === currentMonth)
                        {
                            processingStatusByUserInMonth[userId]++;
                        }
                    }

                    //사원의 처리완료건수가 0이면 행에 추가하지 않습니다.
                    if(totalProcessingStatusByUser[userId] === 0)
                    {
                        delete totalProcessingStatusByUser[userId];
                    }
                }   
        });

        // 사용자별 이번 달 처리완료건수를 내림차순으로 정렬합니다.
        const sortedProcessingStatusByUserInMonth = Object.entries(processingStatusByUserInMonth)
            .sort(([, countA], [, countB]) => countA - countB)
            .reduce((acc, [userId, count]) => {
                acc[userId] = count;
                return acc;
            }, {});

        // "사원별 처리완료 건" 데이터베이스를 전부 삭제합니다.
        for (const page of processingStatusResponse.results) {
            await notion.pages.update({
                page_id: page.id,
                archived: true, // 페이지를 보관 상태로 변경하여 삭제합니다.
            });
        }

        // 새로운 값으로 "사원별 처리완료 건" 데이터베이스를 업데이트합니다.
        for (const userId in sortedProcessingStatusByUserInMonth) {
            await notion.pages.create({
                parent: { database_id: processingStatusDatabaseId },
                properties: {
                    사원: { people: [{ id: userId }] },
                    "이번 달 처리완료건": { number: sortedProcessingStatusByUserInMonth[userId] },
                    "누적 처리완료 건": { number: totalProcessingStatusByUser[userId] },
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