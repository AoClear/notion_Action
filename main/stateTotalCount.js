/*'미처리현황' 블록, '처리완료현황' 블록
1. '미처리현황' 블록, '처리완료현황' 블록 업데이트
 */
require("dotenv").config();
const { Client } = require("@notionhq/client");
const { getAllDatabaseItems } = require("../util");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

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
    const helpDeskResults = await getAllDatabaseItems(helpdeskDatabaseId);
    let waitCount = 0; //"대기"값의 갯수
    let progressCount = 0; //"진행중"값의 갯수
    let addInquireCount = 0; //"추가문의"값의 갯수
    let completeCount = 0; //"완료"값의 갯수
    let devCompleteCount = 0; //"개발완료"값의 갯수

    // -------------------- '헬프데스크'에서 금월 데이터 추출 --------------------
    helpDeskResults.forEach((item) => {
      if (
        moment().format("YYYY-MM") !==
        moment(item.created_time).format("YYYY-MM")
      ) {
        return;
      }

      const stateProperty = item.properties.상태?.select?.name;
      switch (stateProperty) {
        case "대기":
          waitCount++;
          break;
        case "진행중":
          progressCount++;
          break;
        case "추가문의":
          addInquireCount++;
          break;
        case "완료":
          if (item.properties.완료일.date?.start) {
            completeCount++;
          }
          break;
        case "개발완료":
          devCompleteCount++;
          break;
      }
    });
    // ------------------------------------------------------------

    // --------- 기존의 json파일을 불러와 금월 외의 데이터에서 조회 ----------
    const baseFolder = path.join(__dirname, "../data");
    const fullFolderPath = path.join(baseFolder, "stateCountByEmp_data");
    // 파일 경로 설정
    const filePath = path.join(fullFolderPath, "stateCountByEmp.json");
    // JSON 파일 읽기
    let jsonData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      jsonData = JSON.parse(fileContent);
    }

    for (let key in jsonData) {
      for (let key2 in jsonData[key]["대기"]) {
        waitCount += jsonData[key]["대기"][key2].value;
      }

      for (let key2 in jsonData[key]["진행중"]) {
        progressCount += jsonData[key]["진행중"][key2].value;
      }

      for (let key2 in jsonData[key]["추가문의"]) {
        addInquireCount += jsonData[key]["추가문의"][key2].value;
      }

      for (let key2 in jsonData[key]["완료"]) {
        completeCount += jsonData[key]["완료"][key2].value;
      }

      for (let key2 in jsonData[key]["개발완료"]) {
        devCompleteCount += jsonData[key]["개발완료"][key2].value;
      }
    }
    // ------------------------------------------------------------------------

    //"미처리현황" 블록 업데이트
    const unprocessedContent = `미처리 건\n${
      waitCount + progressCount
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
