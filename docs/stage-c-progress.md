# 階段 C：雲端寫入與離線補同步

## 已完成的程式

- Google 登入、Picker、私人／擁有者檔案與 schema 閘門沿用原流程，不增加 OAuth scope。
- `sheets-write.ts`：新增、編輯、刪除運動（含跑步機分段）與影片。每次先重新讀取，檢查 base／local／remote；主紀錄、舊分段 tombstone、新分段使用同一次 `spreadsheets.batchUpdate`。刪除不移除實體列。
- 完整分段比較涵蓋分鐘、速度、坡度及順序。主表保存分段原始分鐘加總四捨五入的整數，畫面使用分段精確總和至小數一位。
- 文字一律明確使用 `userEnteredValue.stringValue`，數字使用 `numberValue`。`= + - @` 等前導字元及原始 apostrophe 不被改寫，也不會被當成公式。讀取改看原生 `userEnteredValue` 型別，拒絕 `formulaValue`，不再把純文字的等號誤判為公式。
- `outbox.ts`：以 subject + spreadsheetId 隔離待同步內容，嚴格挑選合約欄位，不儲存 OAuth Session／Token。送出前保存 uncertain 狀態；收到回應且重新讀回確認後才移除，回應遺失或重開時先核對遠端內容，避免重複新增。
- 已開始傳送且結果未確認的內容暫停編輯。衝突會保留本機意圖，可匯出備份、重試或明確選擇採用雲端內容；只有成功重新讀到雲端後才放棄待同步項目。
- 使用 Web Locks 確保同一瀏覽器的同一帳號／檔案只有一個編輯分頁。其他分頁唯讀；無 Web Locks 的瀏覽器也維持唯讀，不以弱化協調取代。
- 回到前景、恢復連線時接續同步；暫時失敗最多做四次延遲重試，也可手動重試。切換帳號／檔案、登出或切回本機會取消當前工作，遲到回應不能覆蓋新的畫面，舊帳號佇列仍保留。
- 雲端運動與影片表單已接上同步。健康原始資料只由捷徑流程寫入，不能用畫面摘要覆蓋。影片 UI 的識別碼與原始 Sheet 記錄 ID 分開，避免編輯／刪除寫到錯誤 ID。
- JSON 備份以 `videoLibrary` 存裝置影片庫，`videos` 保留給雲端影片；相容先前匯出格式。雲端備份不混入裝置的私人影片庫。

## 檢查結果

已執行 `npm ci`、`npm test`、Python unittest、`npm run build` 與 `git diff --check`：141 項 Vitest、6 項 Python 測試全部通過，TypeScript／Vite／Service Worker 建置成功。沒有可用的 iPhone／Safari 瀏覽器控制工具，因此不宣稱完成實機驗收。

## 真實 Google Sheets 驗證

已先建立升級前原生副本並確認私人，再在使用者授權的原檔新增 TreadmillSegments／Videos、更新兩張核心表的 13 種運動下拉選單。未修改既有健康資料、運動紀錄或分享權限。讀回確認新表欄名、數字格式、資料驗證、凍結標題與篩選器。

另外建立私人驗收副本，清除該測試副本的紀錄後使用虛構資料：

- 同批建立一筆 30.5 分鐘運動、兩段 10.5／20 分鐘與一筆影片。讀回主表 31、兩段精確值、revision 1。
- 同批將舊兩段標為刪除、新增兩段坡度 9%，主表 revision 2；讀回只剩兩個有效分段。
- 以等號開頭的備註與影片名稱，原生讀回均為 stringValue，沒有 formulaValue。
- 刻意加入不合法的子請求，工具回傳錯誤；讀回前一個測試修改未套用，原備註仍保留。
- 私人驗收副本的 fitnessSchemaVersion=1（DOCUMENT／SPREADSHEET）標記、原始欄位格式與篩選器已讀回確認。

這是已連線工具的 Sheets API 寫入驗證，**不是** 使用者 PWA OAuth Token 在 iPhone 上的端到端寫入驗收，也不代表影片已實機試播。真實檔案 URL 留在本次對話，不把私人表 ID 或健康資料寫入 repository。

## 實機驗收清單

1. 更新 PWA，登入原帳號並使用私人副本；新增一筆測試運動，待同步提示消失後，到試算表確認一筆記錄。重新整理後仍存在。
2. 建立快走／跑步的兩段設定；修改速度或坡度，再刪除整筆運動，確認畫面及對應課表更新，Sheet 使用 tombstone。
3. 已登入且正在使用雲端模式時開飛航，新增／修改運動，看到待同步提示；恢復網路後只新增一次。完全關閉後重新開啟，需連線登入才能還原該帳號佇列與檢視。
4. 加入、改名、刪除自己的影片，重新整理後一致。頁內播放另須試播；無法內嵌可開啟 YouTube。
5. 在另一個分頁打開相同檔案，應唯讀。關閉原編輯分頁後重新開啟此頁即可取得編輯權。
6. 試算表手動改動一筆資料後，再送出該筆尚未同步的修改，應顯示衝突並保留裝置內容；先匯出備份再決定是否採用雲端。
7. 切換帳號、登出及授權過期後，不得將前一帳號待同步內容送到新帳號或顯示遲到的回應。

## 一致性界線與官方依據

Google 官方保證同一次 `spreadsheets.batchUpdate` 的子請求一起原子套用，並列出 `drive.file` 可用範圍：
https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate

Google 對字串與公式有不同原生型別：
https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/other#ExtendedValue

寫前重讀及 Web Locks 不提供跨裝置的原子 compare-and-swap。第一版維持單人使用，避免同時在兩個裝置修改同一筆；不宣稱 Sheets 等同具有版本條件交易的資料庫。Apps Script 僅寫健康／步數表，PWA 僅寫運動／分段／影片表，避免兩套寫入器更新同一資料區。

Safari Web Locks 支援的官方背景：https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/ 。執行時仍採能力檢測，不僅憑版本判斷。
