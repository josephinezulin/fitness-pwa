/**
 * 執行前把下方網址替換成自己的試算表網址。
 * 只移除 WorkoutPlans 中「其他欄全空，active 為 FALSE」的核取方塊佔位值。
 * 不修改有 ID、名稱或其他內容的課表，不改分享權限。
 */
function repairFitnessTemplatePlaceholders() {
  const url = '貼上你的試算表網址';
  if (url === '貼上你的試算表網址') throw new Error('請先填入試算表網址');
  const ss = SpreadsheetApp.openByUrl(url);
  const sheet = ss.getSheetByName('WorkoutPlans');
  const expected = ['id', 'weekday', 'type', 'title', 'minMinutes', 'maxMinutes', 'tutorialUrl', 'active', 'updatedAt'];
  if (!sheet || sheet.getMaxColumns() !== 9 || sheet.getMaxRows() > 5001) throw new Error('課表結構不符，停止修復');
  if (JSON.stringify(sheet.getRange(1, 1, 1, 9).getValues()[0]) !== JSON.stringify(expected)) throw new Error('欄名不符，停止修復');
  const rows = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 9).getValues();
  const ranges = [];
  let start = null;
  rows.forEach((row, i) => {
    const placeholder = row[7] === false && row.every((value, col) => col === 7 || value === '' || value === null);
    if (placeholder && start === null) start = i + 2;
    if (!placeholder && start !== null) { ranges.push('H' + start + ':H' + (i + 1)); start = null; }
  });
  if (start !== null) ranges.push('H' + start + ':H' + sheet.getMaxRows());
  if (ranges.length) {
    const cells = sheet.getRangeList(ranges);
    cells.clearDataValidations();
    cells.clearContent();
  }
  SpreadsheetApp.flush();
  Logger.log('課表資料列數：' + Math.max(0, sheet.getLastRow() - 1));
  Logger.log('版本中繼資料：' + JSON.stringify(ss.getDeveloperMetadata().map(m => ({
    key: m.getKey(), value: m.getValue(), visibility: String(m.getVisibility()),
    locationType: String(m.getLocation().getLocationType()),
  }))));
  Logger.log('已完成佔位值修復，未修改其他課表資料或分享權限。');
}
