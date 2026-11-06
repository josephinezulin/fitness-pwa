/**
 * 升級既有的「日常動作」試算表：加入跑步機分段與影片分頁、放寬運動類型下拉選單。
 * 執行前把下方網址替換成自己的試算表網址，然後執行 upgradeFitnessTemplate。
 * 只新增缺少的選用分頁與更新 type 欄下拉選單；不修改、不刪除任何既有資料，不改分享權限。
 * 可重複執行：已存在的分頁只檢查欄名，不覆蓋。
 */
function upgradeFitnessTemplate() {
  const url = '貼上你的試算表網址';
  if (url === '貼上你的試算表網址') throw new Error('請先填入試算表網址');
  const workoutTypes = ['home', 'strength', 'jumprope', 'walk', 'run', 'cycling', 'swim', 'hike', 'yoga', 'pilates', 'stretch', 'ball', 'other'];
  const videoCategories = ['暖身', '居家徒手', '快走／跑步機', '跑步', '重量訓練', '瑜伽', '皮拉提斯', '伸展放鬆', '飛輪／騎車', '跳繩', '其他'];
  const core = {
    // WorkoutPlans stays v1: customized/disabled plans must never be reseeded by an upgrade.
    HealthMetrics: ['id', 'sampleKey', 'measuredAt', 'date', 'timezone', 'metricType', 'value', 'unit', 'source', 'deviceId', 'updatedAt', 'deletedAt'],
    DailySteps: ['id', 'date', 'timezone', 'totalSteps', 'source', 'deviceId', 'revision', 'updatedAt'],
    WorkoutLogs: ['id', 'date', 'timezone', 'type', 'minutes', 'calories', 'note', 'source', 'revision', 'updatedAt', 'deletedAt'],
    WorkoutPlans: ['id', 'weekday', 'type', 'title', 'minMinutes', 'maxMinutes', 'tutorialUrl', 'active', 'updatedAt'],
    SyncLogs: ['requestId', 'deviceId', 'receivedAt', 'rangeStart', 'rangeEnd', 'status', 'acceptedCount', 'rejectedCount', 'errorCode'],
  };
  const optional = [
    {
      name: 'TreadmillSegments',
      headers: ['id', 'workoutId', 'seq', 'minutes', 'speed', 'incline', 'updatedAt', 'deletedAt'],
      numbers: { seq: '0', minutes: '0.0#', speed: '0.0#', incline: '0.0#' },
      lists: {},
      notes: {
        workoutId: '對應 WorkoutLogs.id；只限 walk／run。各段分鐘加總四捨五入需等於該筆 minutes。',
        seq: '段落順序 1–50，同一筆運動不可重複。',
        speed: '跑步機速度 km/h（0.5–25）。',
        incline: '坡度 %（-5–40）。',
        updatedAt: '可留白，或填 UTC ISO 8601 純文字。',
        deletedAt: '未刪除時留白；刪除時填 UTC ISO 8601 純文字。',
      },
      rules: [
        ['seq', '=OR(C2="",AND(ISNUMBER(C2),C2=INT(C2),C2>=1,C2<=50))', '請輸入 1–50 的整數'],
        ['minutes', '=OR(D2="",AND(ISNUMBER(D2),D2>=0.5,D2<=300))', '每段 0.5–300 分鐘'],
        ['speed', '=OR(E2="",AND(ISNUMBER(E2),E2>=0.5,E2<=25))', '速度 0.5–25 km/h'],
        ['incline', '=OR(F2="",AND(ISNUMBER(F2),F2>=-5,F2<=40))', '坡度 -5–40 %'],
      ],
    },
    {
      name: 'Videos',
      headers: ['id', 'url', 'title', 'category', 'minutes', 'updatedAt', 'deletedAt'],
      numbers: { minutes: '0' },
      lists: { category: videoCategories },
      notes: {
        url: 'YouTube 影片網址或 11 碼影片 ID。',
        category: '影片分類，請從下拉選單選擇。',
        minutes: '影片長度（分鐘），可留白。',
        updatedAt: '可留白，或填 UTC ISO 8601 純文字。',
        deletedAt: '不想顯示時填 UTC ISO 8601 時間，或直接刪除該列。',
      },
      rules: [['minutes', '=OR(E2="",AND(ISNUMBER(E2),E2=INT(E2),E2>=1,E2<=600))', '請輸入 1–600 的整數']],
    },
  ];

  const ss = SpreadsheetApp.openByUrl(url);
  const version = ss.getDeveloperMetadata().filter(m => m.getKey() === 'fitnessSchemaVersion');
  if (version.length !== 1 || version[0].getValue() !== '1') throw new Error('不是 fitnessSchemaVersion=1 的日常動作試算表，停止升級');
  const allowed = Object.keys(core).concat(optional.map(spec => spec.name));
  ss.getSheets().forEach(sheet => {
    if (allowed.indexOf(sheet.getName()) < 0) throw new Error('含未定義的工作表「' + sheet.getName() + '」，請先移除或改名再升級');
  });

  // 先全部檢查，確認無誤才修改，避免升級到一半。
  Object.keys(core).forEach(name => {
    const sheet = ss.getSheetByName(name);
    const headers = core[name];
    if (!sheet || sheet.getMaxColumns() !== headers.length || JSON.stringify(sheet.getRange(1, 1, 1, headers.length).getValues()[0]) !== JSON.stringify(headers)) {
      throw new Error(name + ' 的欄名或欄數不符，停止升級');
    }
  });
  optional.forEach(spec => {
    const sheet = ss.getSheetByName(spec.name);
    if (sheet && (sheet.getMaxColumns() !== spec.headers.length || JSON.stringify(sheet.getRange(1, 1, 1, spec.headers.length).getValues()[0]) !== JSON.stringify(spec.headers))) {
      throw new Error(spec.name + ' 已存在但欄名或欄數不符，停止升級');
    }
  });

  const changes = [];
  ['WorkoutLogs', 'WorkoutPlans'].forEach(name => {
    const sheet = ss.getSheetByName(name);
    const col = core[name].indexOf('type') + 1;
    sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(workoutTypes, true).setAllowInvalid(false).build()
    );
    changes.push(name + '.type 下拉選單已更新為 ' + workoutTypes.length + ' 種運動');
  });

  optional.forEach(spec => {
    if (ss.getSheetByName(spec.name)) {
      changes.push(spec.name + ' 已存在，未修改');
      return;
    }
    const sheet = ss.insertSheet(spec.name);
    const rows = 1000;
    const columns = spec.headers.length;
    if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
    if (sheet.getMaxRows() > rows) sheet.deleteRows(rows + 1, sheet.getMaxRows() - rows);
    if (sheet.getMaxColumns() < columns) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
    if (sheet.getMaxColumns() > columns) sheet.deleteColumns(columns + 1, sheet.getMaxColumns() - columns);
    const range = sheet.getRange(1, 1, rows, columns);
    range.setFontFamily('Arial').setFontSize(10);
    range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREEN);
    sheet.getRange(1, 1, 1, columns).setValues([spec.headers])
      .setBackground('#1b4d3e').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 30);
    sheet.setColumnWidths(1, columns, 150);
    range.createFilter();
    spec.headers.forEach((name, i) => {
      const cells = sheet.getRange(2, i + 1, rows - 1, 1);
      cells.setNumberFormat(spec.numbers[name] || '@');
      if (spec.lists[name]) {
        cells.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(spec.lists[name], true).setAllowInvalid(false).build());
      }
      if (spec.notes[name]) sheet.getRange(1, i + 1).setNote(spec.notes[name]);
    });
    spec.rules.forEach(rule => {
      const col = spec.headers.indexOf(rule[0]) + 1;
      sheet.getRange(2, col, rows - 1, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireFormulaSatisfied(rule[1]).setHelpText(rule[2]).setAllowInvalid(false).build()
      );
    });
    changes.push(spec.name + ' 已建立（' + columns + ' 欄）');
  });

  SpreadsheetApp.flush();
  changes.forEach(line => Logger.log(line));
  Logger.log('升級完成：未修改任何既有資料或分享權限。請回到網站按「更新資料」重新讀取。');
  return changes;
}
