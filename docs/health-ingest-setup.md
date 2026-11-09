# 捷徑健康資料上傳 API：私人 Apps Script 部署

狀態（2026-11-09 更新）：使用者已完成私人捷徑上傳，工具已只讀確認私人驗收副本有成功寫入與批次紀錄；既有部署可沿用。獨立端點認證拒絕、鎖定／斷網／每日自動化等情境仍待驗收，不能由成功寫入推定全部通過。PWA 仍以 Google OAuth + Sheets API 讀取私人表；這個端點僅供原生 iOS 捷徑，不假設它可供瀏覽器 CORS 寫入。

## 已驗證與未驗證

使用者已回報 Google 登入及私人試算表「格式檢查通過」。這可作為本人裝置的基本讀取驗收，不能推定拒絕授權、帳號切換、過期與所有 Safari 主畫面情境都已通過。PWA 的運動／分段／課表／影片雲端寫入已實作，健康原始資料仍只由這個捷徑上傳入口處理。

## 尚未部署者的起點與已部署者的下一步

已成功上傳者不需重做以下首次部署；沿用現有專案與捷徑，先完成文末剩餘驗收。以下一次性流程保留給尚未部署的使用者。

1. Google 端：照下方一次性步驟放入程式、設定私人試算表 ID、執行初始化並完成本人授權。將裝置憑證只留在自己的捷徑，部署時先保持服務關閉。
2. 把部署完成的 `/exec` 網址提供給開發流程；**不要提供裝置 Token**。目前環境未連接 Apps Script 部署工具或擁有者授權，不能直接代辦這個首次部署，也不會以 PWA 的 drive.file Token 冒充 Apps Script 授權。
3. 開發流程先用沒有健康資料的未授權請求驗證。啟用後再檢查錯誤憑證確實被拒絕，最後本人在私人測試副本以捷徑寫入並核對。

PWA「設定與備份」的 Apple 健康同步卡片只讀取該私人表的 SyncLogs，能顯示最近批次與上次成功處理時間；PWA 的「最後讀取」不是捷徑上傳成功時間。沒有同步紀錄不代表已部署或沒部署，也可能是請求尚未送出或在認證前被拒絕。卡片沒有新增端點設定或保存憑證。

## 程式檔

[HealthIngest.gs](../apps-script/HealthIngest.gs)

只將這個檔案放入你的私人 Apps Script 專案。不要把含實際 Script Properties 的專案當作公開範本分享。可以沿用私人範本建立器的 standalone 專案，但若專案已有 doGet / doPost，先回報以免函式重名；不直接覆蓋舊端點。

## 一次性部署步驟（需要使用者在 Google 操作）

1. 開啟 https://script.google.com/ ，選擇自己的私人 Apps Script 專案，新增程式碼檔案 `HealthIngest`，貼上完整程式碼並儲存。
2. 建議先用沒有真實健康資料的私人測試副本。檔案須為自己擁有、共用設定為「限制存取」、無其他編輯者或檢視者；五張表與版本標記需符合範本。API 每次驗證裝置後都會檢查這些條件，不自行變更分享權限。
3. 專案設定 → 指令碼屬性（Script Properties），新增 `HEALTH_SPREADSHEET_ID`，值為私人副本網址 `/d/` 與 `/edit` 之間的 ID。
4. 在函式選單選 `initializeHealthIngest` 並執行，授權程式讀取檔案權限及讀寫試算表。此函式不寫入健康紀錄，服務保持關閉。
5. 回到指令碼屬性，可看到：
   - `HEALTH_DEVICE_ID`：捷徑要使用的裝置識別碼。
   - `HEALTH_DEVICE_TOKEN_ONCE`：只複製到自己捷徑的高熵憑證；不要貼到對話、GitHub、PWA、試算表或執行記錄。
   - `HEALTH_DEVICE_TOKEN_SHA256`：服務端驗證用摘要，保留。
   - `HEALTH_INGEST_ENABLED=false`：預設不接受同步。
6. 將裝置 ID 與一次性 Token 保存到自己的捷徑後，刪除 `HEALTH_DEVICE_TOKEN_ONCE` 屬性。未取得 Token 前不要刪除；其他 hash 與裝置 ID 保留。捷徑能查看／分享的人可能取得 Token，請勿分享含憑證版本。
7. 部署 → 新增部署作業 → 類型「網頁應用程式」：以「我」身分執行；需要原生捷徑無互動存取時，存取對象選「任何人」（若帳號提供此選項）。**網址雖可到達，每個 POST 仍由程式驗證裝置 Token 與 ID；未驗證不可讀寫健康資料。**若帳戶政策不允許此部署，不降低認證或變更帳戶政策，回報限制。
8. 複製 `/exec` 部署網址，提供給開發流程檢查未授權請求與 JSON 回應。網址不是 Token，可以提供；不要提供裝置 Token。
9. 在私人測試副本上準備進行授權 POST 測試時，再將 `HEALTH_INGEST_ENABLED` 改為字串 `true`。尚未執行這一步時，回應 `SERVICE_DISABLED` 是預期行為。

這是單人、單一裝置憑證版本。未來其他使用者須對自己的私人副本部署並建立自己的憑證，不使用你的端點或 Token。Client Secret 不用於此流程。

## 請求契約 v1

原生捷徑「取得 URL 的內容」使用 POST，JSON 主體；Token 放 body，不放網址。以下全為佔位值，不能直接當成實際成功測試資料：

```json
{
  "version": 1,
  "requestId": "每個新批次建立一次的UUID，重試沿用",
  "deviceId": "填入自己的裝置ID",
  "token": "只在自己的捷徑填入裝置Token",
  "rangeStart": "2026-11-01T00:00:00+08:00",
  "rangeEnd": "2026-11-07T00:00:00+08:00",
  "metrics": [
    {
      "sampleKey": "穩定樣本識別碼或類型時間數值來源組合",
      "measuredAt": "2026-11-06T08:00:00+08:00",
      "metricType": "weight",
      "value": 68.5,
      "unit": "kg",
      "source": "AppleHealth"
    }
  ],
  "dailySteps": [
    {
      "date": "2026-11-06",
      "totalSteps": 6200,
      "computedAt": "2026-11-06T21:00:00+08:00",
      "source": "iPhone"
    }
  ]
}
```

- 時間範圍最多 31 天；正式自動化預設最近 7 天，手動可分批掃 30 天。時間戳接受明確 offset 或 Z，服務端正規化 UTC；量測的 date 與 timezone 由私人試算表時區推導。
- 體脂用 `metricType=bodyFat`、`unit=percent`、例如 `value=23`。此處不自動猜測 0.23 是否代表 23%，須在捷徑預覽核對單位。
- 每批 metrics + dailySteps 合計 1–200 筆，UTF-8 body 最多 256 KiB；數值必須是真正 number。文字不得以公式等號開頭。
- sampleKey 若使用穩定 Health UUID 最佳；取不到時，可組合指標＋完整開始／結束時間＋標準單位數值＋來源，不用每次新產生 UUID 當 sampleKey。新的 requestId 則必須新產生，同一批重試沿用。
- 每日步數必須是已核對的「該日目前總數」，不直接送幾百筆原始 Steps 當 dailySteps。僅使用目前 iPhone 的來源並逐日核對 Health；API 不會把不同來源樣本自動去重成 Health 總數。
- dailySteps.computedAt 是本次計算日總量的時間；同日新快照取代舊值，較舊重送不覆蓋；相同時間內容衝突會停止。DailySteps.updatedAt 保存這個快照時間以判斷先後，revision 在真實更新時遞增。
- HealthMetrics 以裝置 ID＋sampleKey 去重，同一天的不同量測保留；已刪除樣本的重送不取消 tombstone。

## 回應與重試

必須解析 JSON 的 `ok`，不能只看 HTTP 200。Apps Script ContentService 的錯誤也會以 JSON body 表達。

- 成功：`ok=true`，requestId 與送出相同；acceptedCount 表示本批通過處理的輸入筆數，含重複／舊快照，writtenCount 才是實際新增或更新筆數。
- 原 requestId 重送：回覆 `replayed=true`，不再次寫入。同一 requestId 換內容會回 `REQUEST_ID_REUSED`。
- `AUTH_FAILED`、`PRIVATE_OWNER_REQUIRED`、`SCHEMA_MISMATCH`、`INVALID_METRIC`：停止，不盲目重試。
- `BUSY_RETRY` 或暫時的 `SYNC_FAILED`：可短暫重試最多兩次，再等下次七天回掃。重試相同批次沿用 requestId。
- 最近 50 批的請求摘要保留在 Script Properties，舊日誌仍存在；已過摘要保留期而重送舊 requestId 會 `REQUEST_EXPIRED`，以新批次 ID 重掃原範圍，靠樣本與日期唯一鍵去重。

Script Lock 序列化此端點的健康寫入；本實作使用 SpreadsheetApp 逐表寫入，沒有將多表合併成同一筆原子 batchUpdate。SyncLogs 先記 partial，再寫指標與步數，全部完成才記 committed；中間失敗的同批重試可修復，不重複插入樣本。PWA 對健康表仍唯讀，避免未協調的雙寫；不要在同步期間直接手動改健康資料列。

## 驗收清單

- 服務關閉、GET、缺 Token、錯 Token、錯裝置 ID：不回健康內容、不寫入任何表。
- 正確 Token 的最小體重＋每日步數批次：寫入測試副本，PWA 手動更新後可看見摘要。
- 原批重送 3 次、七天範圍用新批次回掃：量測筆數不增加。
- 步數先 5000，再新快照 6200，再延遲重送 5000：最終仍是 6200。
- 體脂值、單位、UTC／+08:00 量測日期、公式文字與異常範圍核對。
- 部分寫入失敗後重試，日誌從 partial 恢復 committed。
- iPhone 解鎖／鎖定、斷網後補同步、Google redirect 回 JSON、捷徑拒絕健康權限等實機情境。

## 撤銷與輪替

先把 HEALTH_INGEST_ENABLED 設 false 可立即停止寫入。輪替時刪除舊的 HEALTH_DEVICE_TOKEN_SHA256 與任何 TOKEN_ONCE，再執行 initializeHealthIngest；保留 HEALTH_DEVICE_ID，避免輪替後將同一裝置樣本當作新來源。將新 Token 換入私人捷徑後再開啟服務，舊 Token 失效。

## Mac 捷徑匯入

Mac 提供 Apple 官方 `shortcuts sign` 簽署工具，可將準備好的捷徑原始檔簽署後匯入 iPhone。目前尚未交付已簽署捷徑檔，也未驗證本機 iOS 動作的匯入相容性；Mac 簽署、iPhone 健康授權及個人自動化仍需使用者裝置完成。匯入前的共用檔不含 Token，安裝後才在自己的捷徑填入憑證，不分享填好憑證的版本。

## 給 Mac session 的部署後檢查指令

部署完成後，可用 repo 內的工具先驗證未授權請求：

```sh
python3 scripts/check_ingest_endpoint.py --url 'https://script.google.com/macros/s/實際部署ID/exec'
```

這個命令沒有 Token 參數，不需要把自己的憑證放進終端機歷史。只會測 GET、空 POST、固定錯誤 Token，並確認回應不含健康資料；SERVICE_DISABLED 代表服務尚未開啟。若導向 Google 登入頁、回傳 HTML、未授權卻 ok=true，檢查會失敗。通過後仍需用私人捷徑做本人授權的寫入測試。

工具自身測試：`python3 -m unittest discover -s scripts -p 'test_*.py'`，已加入 GitHub Actions。

工具會分開回報 `unauthenticated_mode=service_disabled` 與 `auth_rejected`。前者只證明服務關閉時沒有開放讀寫，啟用後仍須再跑一次；後者只證明固定錯誤憑證被拒絕，不證明正確憑證的寫入成功。檢查中若兩次 POST 回應狀態不一致，會停止驗收，先固定部署／啟用設定再重測。

官方部署流程：https://developers.google.com/apps-script/guides/web 。每日自動化的健康權限、鎖定狀態與 iOS 背景限制仍依 shortcuts.md 的實機清單驗證，不能由部署成功推定。
