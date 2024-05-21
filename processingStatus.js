require("dotenv").config();
const { Client } = require("@notionhq/client");

// Notion API를 초기화합니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// "헬프데스크" 데이터베이스의 ID
const helpdeskDatabaseId = process.env.HELPDESK_DATABASE_ID;

// "미처리현황" 블록의 ID
const unprocessedBlockId = process.env.UNPROCESSED_BLOCK_ID;

// "처리완료현황" 블록의 ID
const processedBlockId = process.env.PROCESSED_BLOCK_ID;

async function updateProcessingStatus() {
  try {
    // "헬프데스크" 데이터베이스에서 행 정보를 가져옵니다.
    const helpDeskResponse = await notion.databases.query({
      database_id: helpdeskDatabaseId,
    });

    let waitCount = 0; //"대기"값의 갯수
    let proceedCount = 0; //"진행중"값의 갯수
    let addInquireCount = 0; //"추가문의"값의 갯수
    let completeCount = 0; //"완료"값의 갯수
    let devCompleteCount = 0; //"개발완료"값의 갯수
    helpDeskResponse.results.forEach((page) => {
      const stateProperty = page.properties.상태?.select?.name; //헬프데스크 '상태'속성
      switch (stateProperty) {
        case "대기":
          waitCount++;
          break;
        case "진행중":
          proceedCount++;
          break;
        case "추가문의":
          addInquireCount++;
          break;
        case "완료":
          completeCount++;
          break;
        case "개발완료":
          devCompleteCount++;
          break;
      }
    });

    //"미처리현황" 블록 업데이트
    const unprocessedContent = `미처리 건\n${
      waitCount + proceedCount
    }개 (+${addInquireCount})`;
    await notion.blocks.update({
      block_id: unprocessedBlockId,
      quote: {
        rich_text: [
          {
            type: "text",
            text: {
              content: unprocessedContent,
              link: null,
            },
            annotations: {
              bold: true,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "red",
            },
          },
        ],
        color: "green_background",
      },
    });

    //"처리완료현황" 블록 업데이트
    const processedContent = `완료 건\n${completeCount}개 (+${devCompleteCount})`;
    await notion.blocks.update({
      block_id: processedBlockId,
      quote: {
        rich_text: [
          {
            type: "text",
            text: {
              content: processedContent,
              link: null,
            },
            annotations: {
              bold: true,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "red",
            },
          },
        ],
        color: "green_background",
      },
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
