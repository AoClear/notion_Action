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
