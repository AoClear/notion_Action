/* '헬프데스크' 데이터베이스 블록 데이터 관리자
1. 2달 이내의 데이터를 제외하고 전부 삭제
 - ex) 금월이 7월이라면 6월, 5월 데이터를 제외하고 삭제
2. 금월을 제외한 데이터 전부 저장
3. 금월을 제외한 상태 갯수 저장
*/
require("dotenv").config();
const { Client } = require("@notionhq/client");
const { getAllDatabaseItems } = require("../util");
const fs = require("fs").promises;
const path = require("path");
const moment = require("moment");
var _ = require("lodash");

// Notion API를 초기화합니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });
// "헬프데스크" 데이터베이스의 ID
const helpdesk_Id = process.env.HELPDESK_DATABASE_ID;

async function deleteData() {
  try {
    // "헬프데스크" 데이터베이스 모든 행 정보
    const helpDesk_Items = await getAllDatabaseItems(helpdesk_Id);

    // 항목 삭제
    for (const item of helpDesk_Items) {
      if (moment().diff(moment(item.created_time), "months") > 2) {
        await notion.pages.delete({ page_id: item.id });
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function saveData() {
  try {
    // "헬프데스크" 데이터베이스 모든 행 정보
    const helpDesk_Items = await getAllDatabaseItems(helpdesk_Id);
    // 월별 데이터 그룹화
    const monthlyData = groupDataByMonth(helpDesk_Items);
    // helpdesk_data 폴더 경로 설정
    const baseFolder = path.join(__dirname, "../data");
    const fullFolderPath = path.join(baseFolder, "helpdesk_data");
    // 월별로 JSON 파일 저장
    for (const [month, items] of Object.entries(monthlyData)) {
      await saveDataToFile(items, fullFolderPath, `${month}.json`);
    }
  } catch (error) {
    console.error(error);
  }

  // 데이터 월별 그룹화
  function groupDataByMonth(items) {
    const groupedData = {};

    items.forEach((item) => {
      const createdDate = moment(item.created_time).format("YYYY-MM");

      //금월 데이터 제외
      if (moment().format("YYYY-MM") === createdDate) {
        return;
      }

      // 데이터를 년월 속성으로 구분
      _.update(groupedData, createdDate, (existing = []) => {
        existing.push(item);
        return existing;
      });
    });

    return groupedData;
  }
}

async function updateStateCountDataByEmp() {
  try {
    // 데이터 파일명 및 폴더 경로 설정
    const fileName = "stateCountByEmp.json";
    const baseFolder = path.join(__dirname, "../data");
    const fullFolderPath = path.join(baseFolder, "stateCountByEmp_data");
    const helpdeskDataFolderPath = path.join(
      __dirname,
      "../data",
      "helpdesk_data"
    );
    const helpdeskDataFiles = await fs.readdir(helpdeskDataFolderPath);

    let newData = {};

    for (const file of helpdeskDataFiles) {
      const filePath = path.join(helpdeskDataFolderPath, file);

      if (path.extname(file) === ".json") {
        try {
          const fileContent = await fs.readFile(filePath, "utf8");
          const jsonData = JSON.parse(fileContent);

          jsonData.forEach((item) => {
            const createdDate = moment(item.created_time).format("YYYY-MM");
            const stateName = item.properties.상태?.select?.name;
            const manager = item.properties.담당자?.people || [];

            manager.forEach((m) => {
              const managerId = m.id;

              // 상태 속성
              _.update(
                newData,
                [createdDate, stateName, managerId],
                (existing) => ({
                  name: m.name,
                  value: (existing?.value || 0) + 1,
                })
              );

              // 작업시간 속성
              _.update(
                newData,
                [createdDate, "작업시간", managerId],
                (existing) => {
                  // 작업시간 추출
                  const timeString =
                    item.properties.작업시간?.rich_text[0]?.plain_text.match(
                      /[\d.]+/
                    )?.[0];
                  const timeValue = timeString ? parseFloat(timeString) : 0; // NaN이 아닌 경우에만 값을 사용

                  return {
                    name: m.name,
                    value: (existing?.value || 0) + timeValue,
                  };
                }
              );
            });
          });
        } catch (error) {
          console.error("Error processing file:", error);
        }
      }
    }

    // 업데이트된 데이터 저장
    await saveDataToFile(newData, fullFolderPath, fileName);
  } catch (error) {
    console.error("Error updating state count data:", error);
  }
}

// JSON 파일로 데이터 저장 (비동기 방식)
async function saveDataToFile(data, folderPath, fileName) {
  const filePath = path.join(folderPath, fileName);
  try {
    // 폴더 경로가 존재하지 않으면 생성
    await fs.mkdir(folderPath, { recursive: true });

    // JSON 데이터를 문자열로 변환하고 파일에 저장
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving data to file:", error);
    throw error;
  }
}

async function run() {
  try {
    //await deleteData();
    await saveData();
    await updateStateCountDataByEmp();
  } catch (error) {
    console.error(error);
  }
}

run();
