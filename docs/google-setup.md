# 第二階段：Google 連線驗收

目前已實作可選用的 Google Identity Services OAuth Token flow、Google Picker，以及只讀格式驗收。**已可將驗收通過的雲端資料投影到首頁唯讀查看；尚無雲端上傳、CRUD、背景同步或 Apps Script 寫入功能。**請先使用沒有健康資料的範本測試。

## 1. 建立範本（可交給 Gemini）

把 [Gemini Prompt](gemini-template-prompt.md) 完整貼給 Gemini，取得私人原生 Google Sheets 網址。若 Gemini 只提供 Apps Script，由使用者自行建立專案、檢視程式碼並執行，授權其建立試算表；不部署成網頁 API。完成後可提供網址讓本開發流程透過已連接 Google Drive 驗收，保持私人即可，不要開啟「知道連結的任何人」。

範本預設只有三筆課表，不包含任何健康紀錄。通過驗收後若要公開供他人複製，另行製作不含個資的公開範本；自己真正使用的資料副本繼續保持私人。

## 2. Google Cloud 的手動設定

這部分是網站的應用設定，Gemini 建立試算表不會自動完成。

1. 在 https://console.cloud.google.com/ 建立專用專案。啟用 **Google Sheets API、Google Drive API、Google Picker API**。
2. 在 Google Auth Platform 設定應用名稱、聯絡 Email、受眾及測試使用者。先維持 Testing，把自己的 Google 帳號加入測試使用者。
3. 建立 OAuth Client，類型選 **Web application**。Authorized JavaScript origins 加入實際 origin，例如 `https://josephinezulin.github.io`，不帶 `/fitness-pwa/` 路徑。此版本使用 popup token flow，不需要另外設定 redirect URI。若要本機測試，另加 `http://localhost:5173`。
4. 使用最小存取範圍：`openid`、`email`、`https://www.googleapis.com/auth/drive.file`。不要求整個 Drive 或全部試算表的廣泛權限。這個 scope 在 Google 授權層級允許選定檔案讀寫，但此程式目前只發送 GET。
5. 建立 API Key，設定「網站」HTTP referrer 限制，例如 `https://josephinezulin.github.io/*`。限制可呼叫的 API 至 Google Picker API（若 Google 當時的 Picker 設定要求其他 API，先依官方文件核對，不移除限制）。API Key 只是 Picker 的可公開識別設定，不能替代 OAuth。
6. 取得同一專案的 OAuth Client ID、API Key 與**數字專案編號**。不是 project ID，也不是 Client Secret。三者在 PWA 設定頁輸入，只存在該瀏覽器的應用設定。

前端可公開這些應用識別碼，但不要提供 OAuth Client Secret、私鑰或自己的登入 Token。此版沒有共用的預設 OAuth 專案；未來給他人使用時，可由維護者提供公開 client 設定，並先完成 Google 要求的 consent screen 發布或驗證。Testing 不代表任何 Google 帳號皆可使用。

## 3. 真實瀏覽器驗收

1. 先完成 GitHub Pages 部署，開啟 PWA → 設定與備份 → Google 試算表連線。
2. 輸入三個公開應用識別設定，點「儲存設定並載入連線元件」。只有使用者主動操作才載入 Google 第三方程式，不會在離線或初次首頁自行載入。
3. 點「登入 Google 並授權選定檔案」。這個獨立按鈕保留 Safari popup 使用者操作；選自己的帳號，確認所要求範圍。
4. 點「選擇自己的副本並驗收」。在 Picker 選擇自己的私人範本副本；授權綁定這個檔案，不由檔名推測。
5. 應顯示格式檢查通過、筆數 0 / 0 / 0 / 3 / 0，以及檔名與時區。
6. 點「在首頁查看這份雲端資料」後，首頁與趨勢應顯示該檔的每日摘要，編輯按鈕停用。切頁保留連線，登出或 Token 到期則返回本機資料。重載不自動顯示上個帳號的快取。
7. 分享中的範本、別人擁有的檔案、Excel、錯誤版本、錯誤欄名、公式或不正確型別均應拒絕。選擇檔案不會修改權限或表格。
8. 在 Safari 與加入主畫面的 PWA 各測一次；測試拒絕授權、取消 popup、取消選檔、Token 過期、Google 撤銷權限、離線、錯誤 origin 與 API Key 限制。
9. 兩個測試帳號依序登入，各自只能選擇已授權且自己擁有的私人副本；登出或授權到期會清除本次雲端檢視並取消未完成的讀取，遲到回應不可更新新會話。

Token 僅存在記憶體；不寫入 localStorage、sessionStorage、URL、JSON 備份或 repo。使用者主動登出亦向 Google 撤銷本次 Token；這可能撤銷此應用已授予的相關權限，日後需重新同意。頁面重載或到期後需重新登入，不承諾永久登入。Service Worker 只 precache 靜態資產，不快取 Google API 回應。

## 驗收範圍與限制

- 每張表目前最多 5000 筆資料、總格線最多 5001 列，欄數依 schema 精確比對。超大範本先停止，不掃描無界範圍。
- 檔案必須自己擁有且未分享；不是只靠檔名或前端帳號字串隔離。Google 權限仍是最終存取控制。
- 私人檔案檢查使用 Drive 的 ownedByMe / shared / canEdit 回應；格式、版本與公式檢查使用 Sheets API。它們的真實 Google 回應仍需上述實機驗收。
- 格式通過不代表去重寫入、離線衝突、原子交易或 iOS 背景同步已完成。
- 首頁預設使用本機資料；明確選擇後可以查看雲端每日摘要，驗收連線不會自動搬移、混入或公開本機紀錄。
- 帳號＋檔案的摘要快取分區與衝突規劃邏輯已備妥；明確匯入本機資料、實際 revision 檢查與寫入、雲端 CRUD 與同步在實機驗收後繼續實作。驗收之前不開啟寫入，避免不相容的表格被修改。

## 官方文件

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/drive/picker/guides/overview
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/sheets/api/guides/metadata

實作及 mock 測試不等於已完成真實 OAuth、CORS、Google Picker 與 iPhone Safari 測試。請將實際測試結果回報後再宣告通過。
