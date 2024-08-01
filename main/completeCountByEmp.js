/*'금월 사원별 처리완료 건' 데이터베이스 블록
1. 데이터베이스 블록 title 해당 월에 맞춰서 업데이트
2. 데이터베이스 값 업데이트
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
// "사원별 처리완료 건" 데이터베이스의 ID
const completeCountByEmp_Id = process.env.COMPLETE_COUNT_BY_EMP_DATABASE_ID;

async function updateCompleteCountByEmp() {
  // "헬프데스크" 데이터베이스 모든 행 정보
  const helpDesk_Items = await getAllDatabaseItems(helpdesk_Id);
  // "사원별 처리완료 건" 데이터베이스 모든 행 정보
  const completeCountByEmp_Items = await getAllDatabaseItems(
    completeCountByEmp_Id
  );
  // "사원별 처리완료 건" 데이터베이스 메타데이터
  const completeCountByEmp_Meta = await notion.databases.retrieve({
    database_id: completeCountByEmp_Id,
  });

  try {
    await updateCompleteCountByEmp_Title();

    const totalCompleteCount = {}; //누적 처리완료 건
    let completeCountInMonth = {}; //금월 처리완료 건
    const progressCount = {}; //진행중 접수 건
    // -------------------- 금월 완료 및 진행중 데이터 갯수 수집 --------------------
    helpDesk_Items.forEach((item) => {
      const manager = item.properties.담당자?.people;
      // 담당자 유효성 검사
      if (!manager) {
        return;
      }
      // 완료일 유효성 검사
      const createdDate = moment(item.created_time).format("YYYY-MM");
      if (createdDate !== moment().format("YYYY-MM")) {
        return;
      }

      for (let i = 0, len = manager.length; i < len; i++) {
        const empId = manager[i].id;

        if (!totalCompleteCount[empId]) {
          totalCompleteCount[empId] = 0;
          completeCountInMonth[empId] = 0;
          progressCount[empId] = 0;
        }

        //헬프데스크 데이터베이스 '상태'속성
        const stateProperty = item.properties.상태?.select?.name;
        switch (stateProperty) {
          case "완료":
            //'누적 처리완료 건' 증가
            totalCompleteCount[empId]++;
            completeCountInMonth[empId]++;
            break;
          case "진행중":
            progressCount[empId]++;
            break;
        }
      }
    });
    // ----------------------------------------------------------------------

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
      for (let key2 in jsonData[key]["완료"]) {
        if (!totalCompleteCount[key2]) {
          totalCompleteCount[key2] = 0;
        }

        if (!completeCountInMonth[key2]) {
          completeCountInMonth[key2] = 0;
        }

        if (!progressCount[key2]) {
          progressCount[key2] = 0;
        }

        totalCompleteCount[key2] += jsonData[key]["완료"][key2].value;
      }

      for (let key2 in jsonData[key]["진행중"]) {
        if (!totalCompleteCount[key2]) {
          totalCompleteCount[key2] = 0;
        }

        if (!completeCountInMonth[key2]) {
          completeCountInMonth[key2] = 0;
        }

        if (!progressCount[key2]) {
          progressCount[key2] = 0;
        }

        progressCount[key2] += jsonData[key]["진행중"][key2].value;
      }
    }
    // ------------------------------------------------------------------------

    // -------------------------- 정렬(오름차순) --------------------------
    // 데이터베이스에 행 추가될 때, 위로 쌓이듯이 추가되기 때문에 반대로 정렬
    completeCountInMonth = Object.fromEntries(
      Object.entries(completeCountInMonth).sort(
        ([, countA], [, countB]) => countA - countB
      )
    );
    //--------------------------------------------------------------------

    await clearData(completeCountByEmp_Items);

    // ----- 새로운 값으로 "사원별 처리완료 건" 데이터베이스를 업데이트 -----
    for (const empId in completeCountInMonth) {
      await notion.pages.create({
        parent: { database_id: completeCountByEmp_Id },
        properties: {
          사원: { people: [{ id: empId }] },
          "이번 달 처리완료 건": {
            number: completeCountInMonth[empId],
          },
          "누적 처리완료 건": { number: totalCompleteCount[empId] },
          "진행중 접수 건": { number: progressCount[empId] },
        },
      });
    }
    //-----------------------------------------------------------------
  } catch (error) {
    console.error(error);
  }

  // "사원별 처리완료 건" 데이터베이스의 제목을 금월에 맞게 수정
  async function updateCompleteCountByEmp_Title() {
    const currentMonth = moment().month() + 1;
    const title = currentMonth + "월 사원별 처리완료 건";
    if (!completeCountByEmp_Meta.title[0].plain_text.includes(currentMonth)) {
      await notion.databases.update({
        database_id: completeCountByEmp_Id,
        title: [
          {
            type: "text",
            text: {
              content: title,
            },
          },
        ],
      });
    }
  }
}

// ---------- 데이터베이스 전부 삭제 ----------
async function clearData(databaseData) {
  for (const item of databaseData) {
    await notion.pages.update({
      page_id: item.id,
      archived: true,
    });
  }
}
// ----------------------------------------

async function run() {
  try {
    await updateCompleteCountByEmp();
  } catch (error) {
    console.error(error);
  }
}

run();
