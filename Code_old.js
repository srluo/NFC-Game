// ✅ 最新 Google Apps Script：支援 gateId + token 雙重驗證
function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById("144IaZ27AX-xMaN5SWHGG_o2knq9kcOvK-kHeC1dpQqg");

  // 1. 報到註冊
  if (action === "register") {
    const uid = e.parameter.uid;
    const name = e.parameter.name;
    if (!uid || !name) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "缺少 UID 或 name" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = ss.getSheetByName("登錄表");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const uidCol = headers.indexOf("UID");
    const nameCol = headers.indexOf("姓名");
    const statusCol = headers.indexOf("狀態");
    const timeCol = headers.indexOf("建立時間");

    for (let i = 1; i < data.length; i++) {
      if (data[i][uidCol] === uid) {
        return ContentService.createTextOutput(JSON.stringify({ status: "exist", message: "已註冊" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const newRow = [];
    newRow[uidCol] = uid;
    newRow[nameCol] = name;
    newRow[statusCol] = "進行中";
    newRow[timeCol] = new Date();
    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "報到成功" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Token 驗證與登錄
  if (action === "pass_token") {
    const uid = e.parameter.uid;
    const uuid = e.parameter.uuid;
    if (!uid || !uuid || uuid.length < 32) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "缺少 uid 或 uuid 結構錯誤" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const gateId = uuid.slice(0, 14);
    const token = uuid.slice(-16);
    const tsHex = token.slice(0, 8);
    const ts = parseInt(tsHex, 16);

    if (isNaN(ts)) {
      return ContentService.createTextOutput(JSON.stringify({ status: "fail", message: "Token 格式錯誤" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const logSheet = ss.getSheetByName("登錄表");
    const tokenSheet = ss.getSheetByName("關卡Token");
    const tokenData = tokenSheet.getDataRange().getValues();
    const header = tokenData[0];
    const gateCol = header.indexOf("關卡_ID");
    const tokenCol = header.indexOf("Token");
    const usedCol = header.indexOf("是否使用");
    const tsCol = header.indexOf("TS");
    const uidCol = header.indexOf("UID");

    // 確認 token 是否已使用（gateId + token 組合）
    for (let i = 1; i < tokenData.length; i++) {
      const rowGate = tokenData[i][gateCol];
      const rowToken = tokenData[i][tokenCol];
      const rowUsed = tokenData[i][usedCol];
      if (rowGate === gateId && rowToken === token && rowUsed === true) {
        return ContentService.createTextOutput(JSON.stringify({ status: "fail", message: "Token 過期或已使用4" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 寫入新 token
    tokenSheet.appendRow([gateId, token, new Date(), true, ts, uid]);

    const logData = logSheet.getDataRange().getValues();
    const logHeaders = logData[0];
    const uidIndex = logHeaders.indexOf("UID");
    const gateMap = {
      "3949500194BB1A": "關卡1",
      "3949500194A506": "關卡2",
      "3949500194BC11": "關卡3",
      "3949500194BB71": "關卡4",
      "39495001949134": "關卡5",
    };
    const gateName = gateMap[gateId];
    const gateColIndex = logHeaders.indexOf(gateName);

    let userRow = -1;
    for (let i = 1; i < logData.length; i++) {
      if (logData[i][uidIndex] === uid) {
        userRow = i + 1;
        break;
      }
    }

    if (userRow > 0 && gateColIndex > -1) {
      logSheet.getRange(userRow, gateColIndex + 1).setValue("✅");
    }

    const finishColIndex = logHeaders.indexOf("完成時間");
    const requiredGates = ["關卡1", "關卡2", "關卡3", "關卡4", "關卡5"];
    const allCleared = requiredGates.every(g => {
      const idx = logHeaders.indexOf(g);
      return idx > -1 && logData[userRow - 1][idx] === "✅";
    });
    if (allCleared && finishColIndex > -1) {
      const finishCell = logSheet.getRange(userRow, finishColIndex + 1);
      if (!finishCell.getValue()) finishCell.setValue(new Date());
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: `${gateName} 打卡成功` }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Token 產生 API
  if (action === "gen_token") {
    const gateId = e.parameter.gateId;
    if (!gateId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "缺少 gateId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000);
    const tsHex = ts.toString(16).padStart(8, "0");
    const rand = Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
    const token = tsHex + rand;

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      token: token,
      uuid: gateId + "00" + token,
      gateId: gateId,
      ts: tsHex
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput("Unsupported action");
}