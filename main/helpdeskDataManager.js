/* '헬프데스크' 데이터베이스 블록 데이터 관리자
1. 2달 이내의 데이터를 제외하고 전부 삭제
 - ex) 금월이 7월이라면 6월, 5월 데이터를 제외하고 삭제
2. 금월을 제외한 데이터 전부 저장
3. 전월 사용자별 상태 갯수 저장
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

      if (!groupedData[createdDate]) {
        groupedData[createdDate] = [];
      }

      groupedData[createdDate].push(item);
    });

    return groupedData;
  }
}

async function updateStateCountDataByEmp() {
  try {
    // "헬프데스크" 데이터베이스 모든 행 정보
    const helpDesk_Items = await getAllDatabaseItems(helpdesk_Id);
    // stateCountByEmp_data 폴더 경로 설정
    const baseFolder = path.join(__dirname, "../data");
    const fullFolderPath = path.join(baseFolder, "stateCountByEmp_data");
    // 파일 경로 설정
    const fileName = "stateCountByEmp.json";
    const filePath = path.join(fullFolderPath, fileName);
    // JSON 파일 읽기
    let jsonData = {};
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      jsonData = JSON.parse(fileContent);
    }

    // 헬프데스크에서 전월 데이터 추출
    let newData = {};
    helpDesk_Items.forEach((item) => {
      const createdDate = moment(item.created_time).format("YYYY-MM");
      //전월 이외 대상은 제외
      if (createdDate !== moment().subtract(1, "months").format("YYYY-MM")) {
        return;
      }
      //날짜속성 초기화
      if (!newData[createdDate]) {
        newData[createdDate] = {};
      }
      //상태속성 초기화
      const stateName = item.properties.상태?.select?.name;
      if (!newData[createdDate][stateName]) {
        newData[createdDate][stateName] = {};
      }

      //담당자(이름)속성 초기화
      const manager = item.properties.담당자?.people;
      for (let i = 0, len = manager.length; i < len; i++) {
        const managerId = manager[i].id;

        //id 초기화
        if (!newData[createdDate][stateName][managerId]) {
          newData[createdDate][stateName][managerId] = {
            name: manager[i].name,
            value: 0,
          };
        }

        newData[createdDate][stateName][managerId].value++;
      }
    });

    // 업데이트된 데이터 저장
    saveDataToFile({ ...newData, ...jsonData }, fullFolderPath, fileName);
  } catch (error) {
    console.error(error);
  }
}

// JSON 파일로 데이터 저장
async function saveDataToFile(data, folderPath, fileName) {
  const filePath = path.join(folderPath, fileName);
  //폴더 경로가 존재하지 않으면 생성
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
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
