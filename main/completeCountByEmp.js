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
var _ = require("lodash");

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

    const data = {};
    // -------------------- 금월 완료 및 진행중 데이터 갯수 수집 --------------------
    helpDesk_Items.forEach((item) => {
      const manager = item.properties.담당자?.people;
      // 담당자 유효성 검사
      if (!manager) {
        return;
      }

      // 데이터 생성날짜가 이번 달이 아닐경우 취소
      const createdDate = moment(item.created_time).format("YYYY-MM");
      if (createdDate !== moment().format("YYYY-MM")) {
        return;
      }

      for (let i = 0, len = manager.length; i < len; i++) {
        const managerId = manager[i].id;

        //헬프데스크 데이터베이스 '상태'속성
        switch (item.properties.상태?.select?.name) {
          case "완료":
            _.update(
              data,
              [managerId, "이번 달 처리완료 건"],
              (value) => (value || 0) + 1
            );

            _.update(
              data,
              [managerId, "Notion 처리완료"],
              (value) => (value || 0) + 1
            );
            break;
          case "진행중":
            _.update(
              data,
              [managerId, "진행중 접수 건"],
              (value) => (value || 0) + 1
            );
            break;
        }
        _.update(
          data,
          [managerId, "누적 작업시간"],
          (value) =>
            (value || 0) +
              parseFloat(
                item.properties.작업시간?.rich_text[0]?.plain_text.match(
                  /[\d.]+/
                )?.[0]
              ) || 0
        );
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
        _.update(
          data,
          [key2, "Notion 처리완료"],
          (value) => (value || 0) + jsonData[key]["완료"][key2].value
        );
      }

      for (let key2 in jsonData[key]["진행중"]) {
        _.update(
          data,
          [key2, "진행중 접수 건"],
          (value) => (value || 0) + jsonData[key]["진행중"][key2].value
        );
      }

      for (let key2 in jsonData[key]["작업시간"]) {
        _.update(
          data,
          [key2, "누적 작업시간"],
          (value) => (value || 0) + jsonData[key]["작업시간"][key2].value
        );
      }
    }
    // ------------------------------------------------------------------------

    // --------------- 기존 'To-do 처리완료' 데이터 불러오기 ---------------
    completeCountByEmp_Items.forEach((item) => {
      _.set(
        data,
        [item.properties["사원"]?.people[0]?.id, "To-do 처리완료"],
        item.properties["To-do 처리완료"]?.number ?? 0
      );
    });
    // -------------------------------------------------------------------

    // -------------------------- 정렬(오름차순) --------------------------
    // 1. data 객체를 배열로 변환
    const entries = Object.entries(data);

    // 2. 배열을 "이번 달 처리완료 건" 기준으로 오름차순으로 정렬
    const sortedEntries = entries.sort(([keyA, valueA], [keyB, valueB]) => {
      return (
        (valueA["이번 달 처리완료 건"] || 0) -
        (valueB["이번 달 처리완료 건"] || 0)
      );
    });
    // --------------------------------------------------------------------

    await clearData(completeCountByEmp_Items);

    // ----- 새로운 값으로 "사원별 처리완료 건" 데이터베이스를 업데이트 -----
    for (const [managerId, info] of sortedEntries) {
      await notion.pages.create({
        parent: { database_id: completeCountByEmp_Id },
        properties: {
          사원: { people: [{ id: managerId }] },
          "이번 달 처리완료 건": {
            number: _.get(info, "이번 달 처리완료 건", 0),
          },
          "Notion 처리완료": {
            number: _.get(info, "Notion 처리완료", 0),
          },
          "진행중 접수 건": {
            number: _.get(info, "진행중 접수 건", 0),
          },
          "To-do 처리완료": {
            number: _.get(info, "To-do 처리완료", 0),
          },
          "누적 작업시간": {
            number: _.get(info, "누적 작업시간", 0),
          },
          "To-do 처리완료": {
            number: todoCompleteCountById(managerId),
          },
        },
      });
    }
    //-----------------------------------------------------------------
  } catch (error) {
    console.error(error);
  }

  function todoCompleteCountById(id) {
    let result = 0;
    switch (id) {
      case "ab96df30-9b33-4c24-bf66-3fc393d82fdb": // 윤창은
        result = 470;
        break;
      case "32eaf579-42a2-4e85-b4ad-e57d56126b95": // 임연주
        result = 633;
        break;
      case "64404aa5-3dae-461e-adda-11d6c30f1b81": // 김홍
        result = 674;
        break;
      case "bb4dc3f9-48b3-4357-a5e1-7a517f44ef85": // 황재호
        result = 303;
        break;
      default:
        result = 0;
        break;
    }

    return result;
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
