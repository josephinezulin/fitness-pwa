# 第二階段前：安全可行性決策

狀態：使用者已回報真實 Google 登入、Picker 選檔與格式驗收通過；已透過連線工具驗證私人 Sheets 的原子批次及純文字寫入。PWA OAuth 寫入的 iPhone 情境與 Apps Script deployment 尚待實機驗收。下列原架構限制仍適用，不以此宣稱 Apps Script 的 CORS 登入可行。

## 原架構的限制

GitHub Pages 為靜態站台，無法安全代管私密憑證。Apps Script Web App 的 Google 登入網頁流程不能當成一般 CORS JSON API。ContentService 會重新導向至 googleusercontent.com，且不提供任意設定 HTTP response header 的一般 API；不能假設可處理自訂 Authorization header 的 OPTIONS 預檢，或跨來源 cookie 登入。iPhone Safari 另有第三方 cookie 與追蹤防護限制。

`fetch(..., {mode:'no-cors'})` 只能拿到 opaque response，無法可靠判定授權、讀取資料或確認寫入；不構成安全同步方案。JSONP、query string Token、公開試算表、無驗證代理與把共用 Token 編進前端皆不可採用。CORS 不是認證，Origin 也不能替代身分驗證。

## 已選定替代方案

**A. 保留 GitHub Pages；瀏覽器使用 Google Identity Services OAuth 與 Sheets API，Apps Script 專供捷徑寫入。**

使用者已在本次對話接受此方案，後續直接依此架構實作；不需再次詢問架構選擇。此方案改變「瀏覽器 API 一律經 Apps Script」的條件。Google OAuth Client ID 是可公開識別碼，不是私密 Token；access token 只留記憶體，過期後以使用者互動重新授權，不寫 localStorage、不放 URL、不放備份。使用者所有的 Sheets 維持私人。優先驗證 `drive.file` + Google Picker 授權選定檔案是否滿足 Sheets 存取；若必須改用更廣的 `spreadsheets` scope，先說明權限範圍並由使用者同意。不得自行增加 scope。

**B. 若堅持所有瀏覽器存取都經 Apps Script：將實際健康應用改由 Apps Script HTML Service 提供，Pages 僅保留公開說明。**

以 Google 身分保護並透過 `google.script.run` 呼叫服務端，不依賴 Pages 跨來源 cookie。但 Apps Script 託管的 PWA Service Worker／同源與離線能力需重新評估，不能承諾完整滿足目前 PWA 部署條件。

在沒有驗證證據時，維持本機 PWA。兩個替代方案均不引入 Vercel、Supabase 或傳統資料庫。

## 原方案驗證矩陣

用隔離測試 Sheet、虛構資料，不使用真實健康紀錄。部署 ID、Sheet ID、OAuth 設定與測試帳號必須由使用者提供或手動建立。

| 測試 | 必須通過 |
| --- | --- |
| 真實 Pages HTTPS origin、Safari 與主畫面模式 | 可完成登入，UI 能讀取成功回應 |
| Google 未登入、非授權帳號、撤銷權限 | 拒絕讀寫，沒有任何健康 payload |
| GET、JSON POST、OPTIONS、redirect chain | 瀏覽器可讀取正確授權結果，不使用 no-cors |
| 過期認證與重送 | 明確回報、重新授權，不重複寫入 |
| 其他網站 origin、直接 HTTP client | 身分驗證仍有效，不能僅以 Origin 檢查 |
| Safari cookie 防護、獨立 PWA | 不依賴關閉瀏覽器安全設定 |

curl 可檢查 header，但不能代表 Safari 的 CORS 與 OAuth 測試通過。測試記錄應保存日期、origin、部署版本、瀏覽器版本、HTTP 狀態與不含 token 的錯誤資訊。

## 手動授權與驗收

使用者建立私人試算表、Apps Script 專案、授予該專案存取試算表；替代方案 A 另需 Google Cloud 專案啟用 Sheets API、建立 Web OAuth Client、加入實際 Pages origin、設定 consent screen 測試使用者。選定範圍後才實作登入與同步。不要將私人 Token 放入 GitHub Actions secrets 再注入前端 bundle。

公開 API 路徑不等於無驗證 API：若日後為捷徑建立「可由網際網路觸及」的 endpoint，每個請求仍必須先完成應用層認證。若帳戶或 Workspace 禁止該部署方式，停止並回報，不變更帳戶政策。

## 參考文件

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/sheets/api/scopes

上述連結供部署時對照最新官方規則；此階段未宣稱以實際 endpoint 驗證成功。

## 階段 C 的瀏覽器寫入

維持原有 drive.file，不增加 spreadsheets 或整個 Drive 的範圍。每次寫入先重新檢查 ownedByMe、canEdit、shared=false、schema、內容與版本；僅向官方 Sheets API 的固定檔案路徑送出有 Bearer Token 的 HTTPS JSON，Token 不進 URL、localStorage、outbox、備份或 repo。

文字明確指定 stringValue，數字指定 numberValue，不產生 formulaValue。讀取原生型別以辨別真正公式，保留等號與 apostrophe 原文；這取代交接文件中可能破壞原文字串的加引號逃逸。

運動／分段一起原子更新；寫後讀回確認，回應遺失後先比對遠端再重試。outbox 按帳號與檔案隔離並嚴格挑選欄位，未確認的意圖不可直接改寫。Web Locks 限制同源同檔案只有一個編輯分頁；不支援時唯讀。跨裝置仍沒有條件交易鎖，避免同時改同一筆。

細節、真實工具驗證與待完成實機清單見 docs/stage-c-progress.md。
