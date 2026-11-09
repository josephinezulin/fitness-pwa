# E7：健康同步結果與部署驗收準備

## 完成範圍

設定與備份頁加入 Apple 健康同步卡片，不新增首頁常駐資訊列。沿用已授權讀取的私人 Sheets SyncLogs；沒有額外請求、scope、端點設定、Token 欄位、Sheet schema 或 Apps Script 程式變更。

卡片分開呈現：本機尚未連線、沒有可用中繼資料、已讀取但沒有紀錄、最近批次 committed／partial／failed，以及上次 committed 批次。無紀錄不推定已部署或未部署，讀取 PWA 的時間也不代表上傳成功。相同收件時間優先顯示未完成狀態，不能被成功批次掩蓋。

SyncLogs.receivedAt 是伺服器收到該批次的時間，不是健康量測時間，也不是精準完成時刻。acceptedCount 是已處理輸入（含重複／舊快照），不是新增資料列；不聲稱全量健康資料已同步。依目前契約，SyncLogs 由健康上傳服務寫入；未授權或驗證前失敗可能不留紀錄，不能僅靠空表診斷所有錯誤。

只投影 receivedAt、status、acceptedCount、rejectedCount，不把 requestId、deviceId、errorCode 任意文字或原始 log 帶進卡片。投影綁定當前帳號／檔案的已驗收 source，只留記憶體，未加入 localStorage、JSON 備份或 Service Worker cache。來源不在（例如只有快取摘要）就顯示待更新；切換帳號／副本／本機不沿用舊紀錄。離線時既有記憶體結果標明尚未重新確認。

## 端點驗收工具

`scripts/check_ingest_endpoint.py` 仍只做 GET、空 POST 與固定錯誤憑證，沒有真實 Token 或健康資料輸入，也不列印原始回應。新增 `unauthenticated_mode`：

- `service_disabled`：只觀察到服務關閉回應，啟用後仍要重測認證拒絕。
- `auth_rejected`：觀察到未授權被拒絕，不等於本人正確憑證寫入成功。
- 兩次 POST 狀態不一致：停止驗收，先固定部署／啟用狀態再重測。

所有結果仍標示 authorized_write_test=not_performed。此工具通過不會自動開啟服務，或代替 iPhone 健康授權與上傳測試。

## 最新本人回報與剩餘驗收（2026-11-09）

使用者已完成私人捷徑上傳並指定私人驗收副本，工具只讀確認有健康資料、有效日期／單位及成功批次；觀察到的現有唯一鍵沒有重複。這是實際副本讀回與本人來源回報，不再標示「未部署」。沒有把私人副本名稱／ID、裝置／請求 ID、健康值、量測日期或筆數存進 repo，也沒有修改副本。

已成功的部署與捷徑可沿用，不要求重建或再建立 Google OAuth client。仍未取得可獨立測試的 /exec 網址，因此尚未驗證缺少／錯誤憑證的實際拒絕行為；每日自動化、鎖定、斷網補同步、同批重送、較舊快照及 Health 畫面總數仍需逐項實機驗收。成功批次不代表上述全部通過，也不能只由目前唯一鍵判定所有未來重送都安全。

若後續進行端點拒絕測試，只需提供 /exec 網址，不提供裝置 Token。本人授權與部署步驟保留於 [部署文件](health-ingest-setup.md#一次性部署步驟需要使用者在-google-操作)，供尚未完成者參考；不把 PWA 的 drive.file 憑證代替 Script 授權。

## E7 歷史程式檢查結果（當時尚未部署）

完整檢查：npm ci、207 項 Vitest（32 檔）、8 項 Python、TypeScript／Vite／Service Worker 正式建置、git diff --check 通過。新增回歸涵蓋無紀錄、無可用來源、亂序／同時刻批次、成功與未完成分開、零假造新增筆數、時區日期、帳號切換、快取缺少狀態及中繼資料不落盤；端點檢查工具新增關閉／認證模式與不一致回應測試。

Chromium 156／Playwright 在 320×852、390×844、844×390 執行正式 dist 本機設定頁與虛構卡片 fixture：每尺寸 16 項（合計 48 項）狀態／文字／邊界／無未捕捉錯誤檢查通過。另有既有 45 項趨勢、表單、離線回歸通過。已查看 320px 未完成批次截圖並提高內文閱讀對比；fixture／截圖／報告在 /tmp/fitness-health-sync-qa，沒有提交 repo，也沒有加入瀏覽器 CI。

以上沒有 Google 端點或私人 API 呼叫，不等於真實健康上傳、Safari 或 VoiceOver 驗收。尚待本輪 PR CI／Pages 部署完成後確認上線。

## 部署後及 iPhone 驗收

1. 沿用現有私人測試副本的部署；關閉時跑端點檢查，啟用後再跑，確認為 auth_rejected。本人用私人捷徑發最小有效批次，核對 JSON ok 與 requestId，不只看 HTTP 200。
2. PWA 更新資料，卡片顯示 committed 批次與收件時間；同批重送不把 acceptedCount 誤認成新增筆數。核對 HealthMetrics／DailySteps 的實際去重與步數覆寫。
3. 在虛構測試資料中提供新 partial／failed 與較舊 committed，卡片應同時顯示未完成／失敗及上次成功，不能顯示一切已同步。
4. 切換帳號／副本、離線與重新開啟，只顯示該工作區已知紀錄；沒有來源時不得沿用另一個帳號或推定成功。
5. iPhone 本人健康權限、拒絕／鎖定／背景／補同步、Sheets OAuth 寫入與影片試播仍需依原清單驗收；Safari／VoiceOver 檢查新卡片閱讀與說明連結。
