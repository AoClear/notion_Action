require("dotenv").config();
const { Client } = require("@notionhq/client");

// Notion API를 초기화합니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// "헬프데스크" 데이터베이스의 ID
const helpdeskDatabaseId = process.env.HELPDESK_DATABASE_ID;

// "처리현황" 블록의 ID
const processingStatus = process.env.PROCESSING_STATUS_BLOCK_ID;

async function updateProcessingStatus() {
  try {
    // "헬프데스크" 데이터베이스에서 행 정보를 가져옵니다.
    const helpDeskResponse = await notion.databases.query({
      database_id: helpdeskDatabaseId,
    });

    const waitCount = 0; //"대기"값의 갯수
    const proceedCount = 0; //"진행중"값의 갯수
    const addInquireCount = 0; //"추가문의"값의 갯수
    const completeCount = 0; //"완료"값의 갯수
    const devCompleteCount = 0; //"개발완료"값의 갯수
    helpDeskResponse.results.forEach((page) => {
      const stateProperty = page.properties.상태.select.name; //헬프데스크 '상태'속성
      switch (stateProperty) {
        case "완료":
          break;
        case "진행중":
          break;
      }
    });

    console.log("ProcessingStatus updated successfully.");
  } catch (error) {
    console.error("Error updating processingStatus:", error);
  }
}

async function run() {
  try {
    await updateProcessingStatus();
    console.log("ProcessingStatus run successfully.");
  } catch (error) {
    console.error("Error processingStatus run status:", error);
  }
}

run();
