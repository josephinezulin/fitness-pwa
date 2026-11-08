/**
 * 建立全新私人健身範本，不修改任何既有檔案。
 * 只需執行 createFitnessTemplate；不需部署，不提供網頁 API。
 * 重複執行會建立另一份新檔案。請在建立後檢查實際共用權限。
 */
function createFitnessTemplate() {
  const updatedAt = new Date().toISOString();
  const workoutTypes = ['home', 'strength', 'jumprope', 'walk', 'run', 'cycling', 'swim', 'hike', 'yoga', 'pilates', 'stretch', 'ball', 'other'];
  const videoCategories = ['床上運動', '坐姿運動', '減脂燃脂', '暖身', '居家徒手', '快走／跑步機', '跑步', '重量訓練', '瑜伽', '皮拉提斯', '伸展放鬆', '飛輪／騎車', '跳繩', '其他'];
  const tutorialUrl = 'https://www.youtube.com/results?search_query=初學者+徒手全身訓練+低衝擊+20分鐘';
  const specifications = [
    {
      name: 'HealthMetrics',
      headers: ['id', 'sampleKey', 'measuredAt', 'date', 'timezone', 'metricType', 'value', 'unit', 'source', 'deviceId', 'updatedAt', 'deletedAt'],
      numbers: { value: '0.0#' },
      lists: { metricType: ['weight', 'bodyFat', 'heartRate'] },
      data: [],
    },
    {
      name: 'DailySteps',
      headers: ['id', 'date', 'timezone', 'totalSteps', 'source', 'deviceId', 'revision', 'updatedAt'],
      numbers: { totalSteps: '0', revision: '0' },
      lists: {},
      data: [],
    },
    {
      name: 'WorkoutLogs',
      headers: ['id', 'date', 'timezone', 'type', 'minutes', 'calories', 'note', 'source', 'revision', 'updatedAt', 'deletedAt'],
      numbers: { minutes: '0', calories: '0.##', revision: '0' },
      lists: { type: workoutTypes },
      data: [],
    },
    {
      name: 'WorkoutPlans',
      // Only initial defaults; the PWA may edit/disable all plans without changing these columns.
      headers: ['id', 'weekday', 'type', 'title', 'minMinutes', 'maxMinutes', 'tutorialUrl', 'active', 'updatedAt'],
      numbers: { weekday: '0', minMinutes: '0', maxMinutes: '0' },
      lists: { type: workoutTypes },
      data: [
        ['home-mon', 1, 'home', '居家徒手訓練', 20, 30, tutorialUrl, true, updatedAt],
        ['walk-wed', 3, 'walk', '健身房上坡快走', 30, 60, '', true, updatedAt],
        ['home-sat', 6, 'home', '居家徒手訓練', 20, 30, tutorialUrl, true, updatedAt],
      ],
    },
    {
      name: 'SyncLogs',
      headers: ['requestId', 'deviceId', 'receivedAt', 'rangeStart', 'rangeEnd', 'status', 'acceptedCount', 'rejectedCount', 'errorCode'],
      numbers: { acceptedCount: '0', rejectedCount: '0' },
      lists: { status: ['committed', 'failed', 'partial'] },
      data: [],
    },
    {
      name: 'TreadmillSegments',
      headers: ['id', 'workoutId', 'seq', 'minutes', 'speed', 'incline', 'updatedAt', 'deletedAt'],
      numbers: { seq: '0', minutes: '0.0#', speed: '0.0#', incline: '0.0#' },
      lists: {},
      data: [],
    },
    {
      name: 'Videos',
      headers: ['id', 'url', 'title', 'category', 'minutes', 'updatedAt', 'deletedAt'],
      numbers: { minutes: '0' },
      lists: { category: videoCategories },
      data: [],
    },
  ];

  // 在建立檔案前檢查定義，避免欄位索引超出格線。
  specifications.forEach(spec => {
    Object.keys(spec.numbers).concat(Object.keys(spec.lists)).forEach(name => {
      if (spec.headers.indexOf(name) < 0) throw new Error(spec.name + ' 的欄位未定義：' + name);
    });
    spec.data.forEach(row => {
      if (row.length !== spec.headers.length) throw new Error(spec.name + ' 的預填欄數不符');
    });
  });

  const ss = SpreadsheetApp.create('日常動作 PWA 範本 v1');
  // 若執行中途失敗，仍可從記錄找到這份新檔；不要將半成品當作完成品。
  Logger.log('本次建立的試算表：' + ss.getUrl());
  ss.setSpreadsheetLocale('zh_TW');
  ss.setSpreadsheetTimeZone('Asia/Taipei');
  ss.addDeveloperMetadata('fitnessSchemaVersion', '1', SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);

  specifications.forEach((spec, index) => {
    const sheet = index === 0 ? ss.getSheets()[0].setName(spec.name) : ss.insertSheet(spec.name);
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
    // 篩選範圍包含未來資料列，不僅是標題。
    range.createFilter();

    spec.headers.forEach((name, i) => {
      const cells = sheet.getRange(2, i + 1, rows - 1, 1);
      if (name === 'active') {
        // Google 會在套用 checkbox 驗證時填入 FALSE；只對實際資料列套用。
        if (spec.data.length) {
          sheet.getRange(2, i + 1, spec.data.length, 1).setDataValidation(
            SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build()
          );
        }
      } else {
        cells.setNumberFormat(spec.numbers[name] || '@');
      }
      if (spec.lists[name]) {
        cells.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(spec.lists[name], true).setAllowInvalid(false).build());
      }
      const notes = {
        date: 'YYYY-MM-DD 純文字；依 timezone 的本地曆日，不是 UTC 截斷日期。',
        timezone: 'IANA 時區，例如 Asia/Taipei。',
        measuredAt: '原量測時間，UTC ISO 8601 純文字。',
        updatedAt: 'UTC ISO 8601 純文字。',
        deletedAt: '未刪除時留白；刪除時填 UTC ISO 8601 純文字。',
        totalSteps: '指定日期的總步數；重同步取代舊值，不累加。',
        value: 'weight 為 kg；bodyFat 為 0–100 的百分比，例如 23；heartRate 為 bpm。',
        revision: '從 1 開始的正整數，用於衝突檢查。',
        workoutId: '對應 WorkoutLogs.id；只限 walk／run。各段分鐘加總四捨五入需等於該筆 minutes。',
        seq: '段落順序 1–50，同一筆運動不可重複。',
        speed: '跑步機速度 km/h（0.5–25）。',
        incline: '坡度 %（-5–40）。',
        url: 'YouTube 影片網址或 11 碼影片 ID。',
        category: '影片分類，請從下拉選單選擇。',
      };
      if (notes[name]) sheet.getRange(1, i + 1).setNote(notes[name]);
    });

    const check = (name, formula, help) => {
      const col = spec.headers.indexOf(name) + 1;
      if (col < 1) throw new Error('驗證欄位不存在：' + name);
      sheet.getRange(2, col, rows - 1, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireFormulaSatisfied(formula).setHelpText(help).setAllowInvalid(false).build()
      );
    };
    const integer = (name, min, max) => {
      const letter = String.fromCharCode(65 + spec.headers.indexOf(name));
      const cell = letter + '2';
      check(name, '=OR(' + cell + '="",AND(ISNUMBER(' + cell + '),' + cell + '=INT(' + cell + '),' + cell + '>=' + min + ',' + cell + '<=' + max + '))', '請輸入 ' + min + '–' + max + ' 的整數');
    };
    if (spec.headers.indexOf('revision') >= 0) integer('revision', 1, 9007199254740991);
    if (spec.name === 'DailySteps') integer('totalSteps', 0, 200000);
    if (spec.name === 'HealthMetrics') {
      check('value', '=OR(G2="",AND(ISNUMBER(G2),OR(AND(F2="weight",G2>=1,G2<=500),AND(F2="bodyFat",G2>=0,G2<=100),AND(F2="heartRate",G2>=20,G2<=250))))', '依 metricType 輸入有效數字；體脂 23% 請填 23');
      check('unit', '=OR(H2="",AND(F2="weight",H2="kg"),AND(F2="bodyFat",H2="percent"),AND(F2="heartRate",H2="bpm"))', 'weight/kg、bodyFat/percent、heartRate/bpm');
    }
    if (spec.name === 'WorkoutLogs') {
      integer('minutes', 1, 1440);
      check('calories', '=OR(F2="",AND(ISNUMBER(F2),F2>=0,F2<=20000))', '熱量需為 0–20000 的數字');
      check('note', '=OR(G2="",AND(ISTEXT(G2),LEN(G2)<=2000))', '備註最多 2000 字');
    }
    if (spec.name === 'WorkoutPlans') {
      integer('weekday', 1, 7);
      integer('minMinutes', 1, 1440);
      check('maxMinutes', '=OR(F2="",AND(ISNUMBER(F2),F2=INT(F2),F2>=1,F2<=1440,OR(E2="",F2>=E2)))', '需為不小於 minMinutes 的 1–1440 整數');
    }
    if (spec.name === 'TreadmillSegments') {
      integer('seq', 1, 50);
      check('minutes', '=OR(D2="",AND(ISNUMBER(D2),D2>=0.5,D2<=300))', '每段 0.5–300 分鐘');
      check('speed', '=OR(E2="",AND(ISNUMBER(E2),E2>=0.5,E2<=25))', '速度 0.5–25 km/h');
      check('incline', '=OR(F2="",AND(ISNUMBER(F2),F2>=-5,F2<=40))', '坡度 -5–40 %');
    }
    if (spec.name === 'Videos') integer('minutes', 1, 600);
    if (spec.name === 'SyncLogs') {
      integer('acceptedCount', 0, 9007199254740991);
      integer('rejectedCount', 0, 9007199254740991);
    }
    if (spec.data.length) sheet.getRange(2, 1, spec.data.length, columns).setValues(spec.data);
  });

  SpreadsheetApp.flush();
  const expectedCounts = [0, 0, 0, 3, 0, 0, 0];
  const report = ss.getSheets().map((sheet, index) => {
    const spec = specifications[index];
    const headers = sheet.getRange(1, 1, 1, spec.headers.length).getValues()[0];
    if (JSON.stringify(headers) !== JSON.stringify(spec.headers) || sheet.getMaxColumns() !== spec.headers.length || sheet.getMaxRows() !== 1000) throw new Error(spec.name + ' 的結構驗收失敗');
    const count = Math.max(0, sheet.getLastRow() - 1);
    if (count !== expectedCounts[index]) throw new Error(spec.name + ' 的資料筆數不符');
    return { name: spec.name, columns: headers.length, records: count };
  });
  const activeValues = ss.getSheetByName('WorkoutPlans').getRange(2, 8, 3, 1).getValues();
  if (!activeValues.every(row => row[0] === true)) throw new Error('課表 active 必須為真正布林值 true');
  Logger.log('建立與結構檢查完成：' + JSON.stringify(report));
  Logger.log('請在分享視窗確認「限制存取」且沒有其他共用對象。');
  Logger.log('Google Sheets 網址：' + ss.getUrl());
  return ss.getUrl();
}
