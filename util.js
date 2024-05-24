const { Client } = require("@notionhq/client");

// Notion API를 초기화합니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 모든 행을 가져오는 함수
async function getAllDatabaseItems(databaseId) {
  let results = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: nextCursor,
    });

    results = results.concat(response.results);

    hasMore = response.has_more;
    nextCursor = response.next_cursor;
  }

  return results;
}

module.exports = { getAllDatabaseItems };
