require("dotenv").config();
const { Client } = require("@notionhq/client");

// Notion API를 초기화합니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// "헬프데스크" 데이터베이스의 ID
const helpdeskDatabaseId = process.env.HELPDESK_DATABASE_ID;

// "사원별 처리완료 건" 데이터베이스의 ID
const empCompleteCountDatabaseId = process.env.EMP_COMPLETE_COUNT_DATABASE_ID;

// 사용자별로 "상태" 속성의 "완료"값의 갯수를 가져와서 "사원별 처리완료 건" 데이터베이스에 자동으로 기입하는 함수
async function updateEmpCompleteCount() {
  try {
    // "헬프데스크" 데이터베이스에서 행 정보를 가져옵니다.
    const helpDeskResponse = await notion.databases.query({
      database_id: helpdeskDatabaseId,
    });

    // "사원별 처리완료 건" 데이터베이스에서 행 정보를 가져옵니다.
    const empCompleteCountResponse = await notion.databases.query({
      database_id: empCompleteCountDatabaseId,
    });

    // 데이터베이스의 메타데이터를 쿼리하여 가져옵니다.
    const empCompleteCountInfo = await notion.databases.retrieve({
      database_id: empCompleteCountDatabaseId,
    });

    // 현재 날짜를 가져옵니다.
    const currentDate = new Date();
    // 현재 연도와 월을 가져옵니다.
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript의 getMonth()는 0부터 시작하므로 1을 더해줍니다.

    const title = currentMonth + "월 사원별 처리완료 건";
    // "사원별 처리완료 건" 데이터베이스의 제목을 이번 달에 맞게 수정합니다.
    if (!empCompleteCountInfo.title[0].plain_text.includes(currentMonth)) {
      await notion.databases.update({
        database_id: empCompleteCountDatabaseId,
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

    // 사용자별로 "상태" 속성의 "완료"값의 갯수를 계산합니다.
    const totalCompleteCountByEmp = {}; //누적 '완료'값의 갯수
    const completeCountByEmpInMonth = {}; //이번달 '완료'값의 갯수
    const proceedCountByEmp = {}; //'진행중'값의 갯수
    helpDeskResponse.results.forEach((page) => {
      // 담당자가 유효한 경우에만 처리합니다.
      const manager = page.properties.담당자.people;
      if (!manager || manager.length === 0) {
        return;
      }

      const empId = manager[0].id;
      if (
        !empId ||
        !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          empId
        )
      ) {
        return;
      }

      if (!totalCompleteCountByEmp[empId]) {
        totalCompleteCountByEmp[empId] = 0;
        completeCountByEmpInMonth[empId] = 0;
        proceedCountByEmp[empId] = 0;
      }

      const stateProperty = page.properties.상태?.select?.name; //헬프데스크 '상태'속성
      switch (stateProperty) {
        case "완료":
          // completionDate가 유효한 경우에만 처리를 진행합니다.
          const completionDate = page.properties.완료일.date?.start
            ? new Date(page.properties.완료일.date.start)
            : null;

          if (!completionDate) {
            return; // 날짜가 null이거나 유효하지 않은 경우 함수 실행 종료
          }
          // "상태" 속성이 '완료'이고, "완료일" 속성이 현재 연도와 월에 속하는 경우에만 처리합니다.
          const parsedCompletionDate = new Date(completionDate);
          const completionYear = parsedCompletionDate.getFullYear();
          const completionMonth = parsedCompletionDate.getMonth() + 1;
          totalCompleteCountByEmp[empId]++;
          if (
            completionYear === currentYear &&
            completionMonth === currentMonth
          ) {
            completeCountByEmpInMonth[empId]++;
          }
          break;
        case "진행중":
          proceedCountByEmp[empId]++;
          break;
      }
    });

    // 사용자별 이번 달 처리완료건수를 내림차순으로 정렬합니다.
    const sortedCompleteCountByEmpInMonth = Object.entries(
      completeCountByEmpInMonth
    )
      .sort(([, countA], [, countB]) => countA - countB)
      .reduce((acc, [empId, count]) => {
        acc[empId] = count;
        return acc;
      }, {});

    // "사원별 처리완료 건" 데이터베이스를 전부 삭제합니다.
    for (const page of empCompleteCountResponse.results) {
      await notion.pages.update({
        page_id: page.id,
        archived: true, // 페이지를 보관 상태로 변경하여 삭제합니다.
      });
    }

    // 새로운 값으로 "사원별 처리완료 건" 데이터베이스를 업데이트합니다.
    for (const empId in sortedCompleteCountByEmpInMonth) {
      await notion.pages.create({
        parent: { database_id: empCompleteCountDatabaseId },
        properties: {
          사원: { people: [{ id: empId }] },
          "이번 달 처리완료 건": {
            number: sortedCompleteCountByEmpInMonth[empId],
          },
          "누적 처리완료 건": { number: totalCompleteCountByEmp[empId] },
          "진행중 접수 건": { number: proceedCountByEmp[empId] },
        },
      });
    }

    console.log("EmpCompleteCount updated successfully.");
  } catch (error) {
    console.error("Error updating empCompleteCount:", error);
  }
}

async function run() {
  try {
    await updateEmpCompleteCount();
    console.log("EmpCompleteCount run successfully.");
  } catch (error) {
    console.error("Error empCompleteCount run status:", error);
  }
}

run();
