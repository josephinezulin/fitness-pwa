# 階段 E：後續結構與離線改善

## E1：公開影片縮圖快取

已加入獨立的 Workbox runtime cache，只匹配 GET 圖片、HTTPS 的 i.ytimg.com、11 碼影片 ID 與 hqdefault.jpg 路徑。拒絕帶 Authorization 的請求與任何 query string，不匹配 Google OAuth、Sheets、Apps Script 或 YouTube 播放器。

採 StaleWhileRevalidate，最多 24 張、期限 14 天，遇 quota error 可清除這個縮圖快取。快取是最佳努力，iOS 仍可回收儲存。影片本身不離線下載；離線提示只承諾部分曾載入縮圖。接受狀態 0 只用於跨來源不透明圖片，不作 JSON API、登入或健康資料存取的替代。

已檢查產出的 Service Worker：路由函式完整內嵌，沒有依賴遺失的模組變數；包含指定策略、數量與時效限制。新增邊界測試，排除健康／登入／影片 URL、偽造子網域、HTTP、認證 header、query、POST 與非 image 請求。

本輪完整檢查通過：167 項 Vitest、6 項 Python、TypeScript／Vite／Service Worker 建置及 diff 檢查。未進行 iPhone 的真實離線縮圖驗收，也不宣稱 YouTube 影片可離線播放。

官方依據：

- https://developer.chrome.com/docs/workbox/caching-resources-during-runtime
- https://developer.chrome.com/docs/workbox/modules/workbox-expiration

實機：連線瀏覽影片清單、捲動載入縮圖後切離線，確認已快取的部分縮圖保留、沒有快取的影片仍顯示名稱；恢復網路時縮圖可更新。Google 登入與健康資料請求不可從此 cache 回傳。

E1 的 PR #7 已合併為 `3542d7adbcf90ce73f0407550e0b3b11405d8c31`；Pages run 42306449542 成功，首頁、新版資產與含縮圖規則的 Service Worker 已 HTTP 讀回。

## E2：頁面拆分

原本 1,217 行的 main.tsx 改為入口；App.tsx 保留工作區、Google Session callback、導覽、outbox、帳號切換取消、草稿及備份協調。總覽、課表指南、健康摘要、設定、健康圖表、運動紀錄與本週統計拆至 pages/。影片庫沿用既有獨立元件。

SettingsPage 持續掛載，切頁只改可見性，不能重建 CloudPanel 或重置登入。課表管理也持續掛載並按帳號／檔案設 key：同帳號切頁保留未儲存草稿、阻擋 PWA 更新；換帳號／檔案清除草稿。DOM 整合測試已驗證切頁不卸載 CloudPanel、草稿保留與切換帳號清除，Token 不進裝置快取。

## E3：自訂每週課表

- WorkoutPlans 實際資料投影到可選 Data.plans，包含停用列；缺少舊 plans 才使用預設三筆，明確空陣列或全部停用不復活預設值。JSON 備份與還原保留設定。
- 新增／編輯標題、ISO 星期、13 種運動、建議分鐘範圍與 HTTPS YouTube 教學，啟用／停用保留原列。直接影片需點擊才載入 youtube-nocookie 播放器，搜尋連結於 YouTube 開啟；未宣稱實機播放通過。
- 同一 weekday/type 僅允許一筆啟用，避免一筆紀錄完成重複目標；不同類型可同日安排。完成定義仍是同日同類型有正分鐘數，建議時長不作硬性門檻。
- 沿用 schema v1 九欄；檢查過四份 schema／腳本，建立腳本只在新檔提供三筆預設，升級與健康上傳不重填課表。沒有新增分頁、授權範圍或必要手動 Google 設定，也沒有修改使用者的實際課表。
- 雲端寫入沿用私人副本檢查、typed cells、outbox、帳號／檔案隔離、Web Locks 及寫後讀回。比對完整課表及 updatedAt，重試相同結果不重複新增；停用不用刪列。保留 coalesce 的先後位置，避免停用／新增同一時段的順序倒置。
- 離線課表若被另一個遠端 ID 佔用時段，保留分區的裝置內容與意圖、標記衝突並停止課表寫入；已確認其他運動寫入後，剩餘課表出現相同衝突亦有測試。只有成功重讀雲端後才可放棄修改。跨裝置仍沒有原子 CAS，不宣稱解決同時修改。

本輪檢查：186 項 Vitest（27 個檔案），6 項 Python，TypeScript／Vite／Service Worker 建置及 diff 檢查。測試只用虛構資料；DOM／mock 寫入測試不等於 iPhone OAuth 實際寫入驗收。PR／CI／正式部署完成後，記錄於 autonomous-progress.md。

E2／E3 的 PR #8 已合併為 `ddd1f6c9b00fe20bd061183cc47adb2ec2ed56c5`；PR CI 及 Pages run 42313475934 成功。正式首頁、index-5MQcn3vJ.js、index-B7X9vcmP.css、sw.js 已 HTTP 200，讀回 JS 有管理／儲存課表與重複時段規則，SW 包含新版 JS 及既有縮圖快取。

官方方案依據：

- https://react.dev/learn/sharing-state-between-components （共享狀態留在共同父層）
- https://developers.google.com/workspace/sheets/api/guides/batchupdate （明確欄位及批次更新；失敗不部分套用）

## 手動驗收

1. 更新 PWA，在本週課表新增週二瑜伽、修改分鐘、停用及再啟用；同日同類型重複啟用應被阻擋。全部停用後關閉重開，應維持 0 / 0，不出現三筆預設。
2. 本機匯出 JSON，修改後還原，課表應一致；舊無 plans 備份仍顯示預設課表。
3. Google 登入選原私人副本，修改一筆課表並等同步完成，在 Sheets 檢查同列及 updatedAt；離線修改後重連／重新授權，確認補同步不重複新增。這仍待真實 Safari OAuth 寫入驗收。
4. 課表表單未儲存時切到總覽再返回，保留內容；切另一帳號或副本則不帶入舊草稿。開啟表單時更新版本應被保護。
5. iPhone Safari／主畫面 PWA 檢查 320–390px、橫向、鍵盤與文字縮放；試播課表 YouTube、測試失敗外連備援。尚未實機執行，不能稱為通過。

## E4／E5：維護與趨勢閱讀

E4 的 PR #9 已合併並部署為 `ce28d33564cca7460d21b88ba3e6784c97f1742b`，PR CI 42313922331、Pages 42314061084 成功；正式資產讀回 HTTP 200，舊 Actions Node 20 runtime 提示已消失。詳見 maintenance.md，不需重做此更新。

E5 接續提供完整健康曆日、缺值斷線、單筆資料點、每日／每週數值表與鍵盤 Tooltip。保留 Recharts 2.15.4、既有健康唯讀及同步架構。本機完整 196 項 Vitest、6 項 Python、TypeScript／Vite／Service Worker 與 diff 檢查通過；實作、官方依據及實機待驗收見 [趨勢閱讀與可及性](trend-accessibility.md)。PR／上線結果接續查 GitHub，不把 DOM 測試當作 iPhone 結果。

## E6：帳號資訊收進頭像

依使用者要求移除頁面上方的私人雲端長資訊列與重複模式文字。右上「我」改為 44px 頭像按鈕，展開後才顯示私人試算表名稱、時區、最後讀取時間、更新資料、管理 Google 連線及切回本機。切回本機保留原本的語意，不是 Google 登出；登入／選檔／登出仍由持續掛載的 CloudPanel 處理。

面板採原生按鈕 disclosure（aria-expanded／controls），不套用需要完整方向鍵選單模式的 menu role。Escape 關閉並回到頭像、點外部／Tab 離開／換頁／開表單／換帳號或檔案即收起，舊頁返回也不重開私人資訊。更新資料於離線／讀取／寫入中停用；待同步與同步／讀取失敗提示仍顯示在內容區，不藏掉需要處理的狀態。未移動 Token、登入生命週期、API 或 outbox。

完整 199 項 Vitest（30 檔）、6 項 Python、TypeScript／Vite／Service Worker 建置及 diff 檢查通過。新增測試覆蓋私人資訊預設收合、更新限制、切回本機、Escape／外部／Tab／換帳號與頁面，並在 App 整合測試確認 CloudPanel 不卸載及待同步提醒不需打開頭像就看得到。

另以 Chromium 156／Playwright 在 320×852、390×844、844×390 做 33 項頭像檢查：正式 dist 的本機面板、連線設定導覽，及只使用虛構 CloudIdentity 的獨立元件 fixture（長標題／時區／窄螢幕與橫向／焦點離開／外點）。沒有真實 Google 授權或 Sheets 呼叫。查看 320px 面板截圖，無水平溢位；既有 45 項趨勢／表單／離線 smoke check 也通過。工具、fixture、報告與截圖在 /tmp/fitness-avatar-qa，沒有放進 repo，且未加入瀏覽器 CI。仍需 iPhone Safari／VoiceOver 實機檢查。

E6 的 PR #11 已合併為 `714f888d6959cb9b57e4f532aa2ab2baa2607268`；PR CI 42331452612、Pages 42331511274 成功，正式資產 HTTP 200，320px 正式站 Chromium 的頭像與設定導覽通過。

## E7：健康同步結果與部署驗收

設定頁新增健康同步狀態卡片，區分 PWA 讀取與健康批次成功，保留最近失敗／未完成與上次成功。同步中繼資料不落盤、不改 schema／權限；驗收工具區分服務關閉與未授權拒絕，拒絕不一致結果。207 項 Vitest、8 項 Python 與建置通過，48 項卡片／設定頁瀏覽器檢查及既有 45 項 smoke check 通過。詳細結果與需要使用者提供的部署網址見 [健康同步驗收準備](health-sync-readiness.md)；本輪沒有執行真實健康端點測試。

## 下一個可交付部分

- 若有使用者實機回報，先修正再擴充；Apps Script 部署與 iOS 健康捷徑尚待本人授權與手機操作，不假造 Mac 或捷徑控制能力。
- 已完成趨勢文字／表格替代、缺值語意與 E8 健康摘要長清單閱讀；先確認本輪 PR／Pages 結果，再依新的實機回報改善。Recharts 主要版本遷移仍待獨立評估及實機證據。
- 保留「逐筆」課表同步的限制：跨裝置同時修改，或複雜離線時段對調，可能需要處理衝突；未實作多筆課表的條件交易。

回來先檢查 PR／部署與使用者回報，保護其他工作階段的修改。

## E8：健康摘要的日期範圍與分批閱讀

先前健康頁一次列出全部紀錄，日期累積後手機頁面會變得很長。摘要現在跟隨圖表的 7／30／90 天，以試算表／本機現有參考日及曆日 key 篩選，起迄均包含。勾選「全部日期」可查看所有儲存日期，包含被圖表排除的未來日期，並在該列明確標記；不把未來值放入今天或趨勢。

每次先顯示最新 14 筆，再由「再顯示」逐批展開；數量狀態列同步更新。四項健康數值使用有名稱的 dl，真實 0 和未記錄區分，步數有千分位；僅調整數字顯示精度，不重寫原始值。空時段可切全部日期找舊資料，完全無紀錄時有明確提示。雲端健康維持唯讀，本機刪除按鈕以日期區分，控制項至少 44px。

分批視窗與全部日期屬於暫時閱讀狀態，不新增 localStorage、Google scope、Sheet 欄位、API 或快取。換帳號／副本、參考日或圖表範圍時以 React key 重設摘要，保留圖表與其範圍欄位焦點；一般資料重讀或刪除不重設已展開的範圍。按下再顯示後焦點移到首筆新增日期，讓鍵盤使用者可接著讀；沒有自動無限載入或背景請求。所有原始紀錄仍供備份、雲端同步與趨勢使用，沒有截斷儲存。

官方方案參考：React 的 key 可界定需要重設的元件狀態；W3C 的 status message 說明建議讓簡短結果數量可由輔助技術辨識。這裡只把數量設為 status，不把整份清單設為 live region；不宣稱已完成 VoiceOver 或 WCAG 認證。

- https://react.dev/learn/preserving-and-resetting-state
- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

完整檢查：213 項 Vitest（33 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置與 diff 檢查通過。新增 DOM 測試涵蓋日期邊界、真實零與缺值、排序不修改輸入、分批與末批焦點、重讀／刪除保留展開範圍、全部日期及未來日期、換帳號／檔案／日期／範圍重設、圖表不重掛、空狀態與雲端唯讀。

實際 Chromium／Playwright 在 320×852、390×844、844×390 使用 181 筆虛構本機摘要，63 項摘要檢查通過：初始 14／30 筆、全部日期 14／181、分批 28 筆、焦點移至新增日期且在視窗內、範圍欄位焦點保留、刪除後數量更新、其他資料保留、空時段找舊資料、44px 控制項、無水平溢位、離線重載及零 pageerror。已檢視窄螢幕與橫向截圖；既有 18 項平滑曲線及 45 項介面／表單／離線回歸也通過。腳本與報告在 `/tmp/fitness-pwa-browser/`，沒有提交 repo 或加入瀏覽器 CI。

沒有登入 Google 或修改私人試算表；iPhone Safari／文字縮放／VoiceOver 仍需實機檢查。PR CI、合併與正式站部署結果追加在本次 PR，接續時先查最新狀態。

## E9：常做的運動再記一次

總覽最近紀錄與運動紀錄頁新增「再記一次」。帶入來源的類型、分鐘、備註及每一段跑步機速度／坡度，作為可修改的新草稿；戶外快走／慢跑保留非跑步機模式。日期使用既有工作區的今天（雲端採試算表時區），來源日期只放在提示，不當作新紀錄日期。舊 ID、熱量與影片觀看 metadata 不複用，新 ID 只於儲存建立；熱量起始為 0，提醒依本次活動填寫或明確套用估算。

草稿由 App 協調，總覽與完整紀錄共用 callback／權限檢查；換帳號／副本沿用既有清草稿與關閉表單機制。分段陣列及各物件複製後才交給表單，改值或取消不動來源。只有確認儲存才走既有本機／雲端新增與 outbox；不自動完成紀錄、不替影片加觀看次數，不新增 Sheet 分頁、API、OAuth scope 或草稿持久儲存。這是以既有紀錄作為填寫起點，個人自訂跑步機範本的獨立雲端清單仍未加入。

官方方案依據：React 建議陣列與內部物件以新副本更新，相關元件共享的狀態由共同父層協調。沿用 App 的草稿生命週期，沒有另建跨帳號的範本快取。

- https://react.dev/learn/updating-arrays-in-state
- https://react.dev/learn/sharing-state-between-components

驗證：219 項 Vitest（34 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置、格式及 diff 檢查通過。新增測試覆蓋分段副本、不帶舊識別／熱量／觀看欄位、戶外模式、今天日期與新 ID、讀取／取消不寫入、修改來源不受影響、總覽及完整紀錄的 callback 與不可編輯狀態。

Chromium 在 320×852、390×844、844×390 的 57 項再記錄檢查通過：44px 入口、總覽與完整紀錄預填、取消、明確熱量、新 ID 與來源保留、戶外模式、表單不溢位，以及離線重載後再次記錄瑜伽並儲存；已查看 320px 草稿截圖。既有 66 項數值清單內捲動及 45 項介面／表單／離線回歸也通過。使用虛構本機資料，腳本與報告在 `/tmp/fitness-pwa-browser/`，未加入瀏覽器 CI。

本輪未登入 Google、修改私人試算表或執行健康上傳。正式站結果記錄在本次 PR；iPhone Safari／VoiceOver 及本人 OAuth 新增、離線補同步仍待實機驗收。

實機方式：更新 PWA 後，對一筆舊跑步機紀錄按再記一次，確認今天日期、兩段速度／坡度與新熱量；改一段後取消，來源應不變。再開一次並儲存，應新增一筆而非覆蓋。對戶外健走重試，跑步機應不勾選；雲端登入時重試新增與離線補同步，換帳號／副本時舊草稿應關閉。

## E10：長表單保留可見的標題與關閉按鈕

以 50 段虛構跑步機紀錄重現：舊 320px 介面滑到底時，關閉按鈕的 y 座標約 -2,978px，必須回捲才可關閉。改為對話框採縱向 flex，標題列不縮小且留在捲動區外，表單設 min-height: 0 並獨立捲動。沿用既有 90dvh 高度上限、窄螢幕 padding 與 16px 輸入欄位，關閉目標增為至少 44px。表單邊界的捲動不連帶推動背景，聚焦第一個欄位時可捲回標題下方，沒有用浮動覆蓋層遮住輸入欄位。

只改共用樣式及標題 class；沒有變更資料、表單提交、授權或草稿生命週期。保留既有 Tab／Shift+Tab 循環、Escape 關閉與關閉後焦點返回入口。參考 W3C APG 的 modal dialog 鍵盤、焦點與可見關閉控制項說明：https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ 。這不是完整 WCAG／VoiceOver 認證。

完整 219 項 Vitest（34 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置與 diff 檢查通過。實際 Chromium 在 320×852、390×844、844×390 共 63 項長表單檢查通過：50 段全部保留、內容獨立捲動、標題／關閉保持可見及可點、44px 目標、90dvh 上限、無水平溢位、邊界滾動、取消不寫入、焦點返回、首欄不被遮住、Tab／Shift+Tab／Escape、橫向切換保留草稿、完整運動儲存及健康短表單儲存。另有既有 57 項再記錄與 45 項介面／表單／離線檢查通過；已檢視 320px 與橫向底部截圖。測試只用虛構資料，腳本、截圖與報告位於 `/tmp/fitness-pwa-browser/`，沒有新增瀏覽器 CI 或登入 Google。

正式合併、CI 與部署結果追加於本次 PR。iPhone Safari／軟體鍵盤／文字縮放／VoiceOver 仍待實機檢查：開啟多段運動，滑至最後填備註、旋轉螢幕、關閉／重開並儲存，確認標題可見、欄位可聚焦與原資料一致。

## E11：瀏覽器回歸納入 CI

將暫存腳本中的六個核心使用情境整理為 repo 內的 Playwright 測試，在三種 viewport 共跑 18 個案例。PR 與 Pages build 都先建置，再以 `/fitness-pwa/` 子路徑驗證同一份 dist，瀏覽器失敗即停止部署；失敗時保留虛構測試 context 的截圖、trace 與 HTML 報告七天。沒有新增產品功能或 Google 權限，也沒有將測試資料編入網站。

完整本機 219 項 Vitest、8 項 Python、TypeScript／Vite／Service Worker 建置、E2E 型別檢查與 18 個 Chromium 案例通過。正式 GitHub 安裝與 workflow 結果追加於本次 PR；Safari／OAuth／健康捷徑仍需實機驗收。執行方式、官方依據與診斷範圍見 [瀏覽器測試](browser-tests.md)，不再把本輪新增的這 18 案例稱為「尚未加入 CI」；先前更完整的暫存 smoke 腳本仍可依需要手動使用。


## E12：JSON 還原綁定原工作區並可取消

以虛構帳號與延遲 File.text() 的整合測試重現：選本機備份後，在讀取完成前切入雲端，舊還原函式會透過當時的工作區把備份運動排入雲端 outbox。修正前測試確實失敗（預期 0 筆，實際 1 筆），沒有連線 Google 或修改私人表。

現在選檔時只建立本機還原 handle，記住工作區 epoch、目前資料參考及本機儲存內容；讀檔完成與取代確認後都重新檢查，apply 再同步檢查一次。切到其他帳號／副本再切回也讓舊 handle 失效。影片清單與本機偏好也比對讀取前的內容；若期間新增運動、修改偏好或另一個分頁改寫儲存，停止舊還原並保留新資料。

讀檔使用獨立序號，取消、選取新檔案或元件卸載後的舊結果不再確認、寫入或覆蓋訊息。設定頁顯示讀取狀態與「取消讀取」，讀取時暫停重選檔案、載入示範資料及 PWA 版本更新。保留原本一次原生取代確認與 10 MB 上限，沒有新增登入、Google scope、Sheet 欄位或健康 API。

檔案讀取本身使用 Blob.text() Promise；「取消」表示忽略稍後的結果，不宣稱中斷底層 I/O。依 React 官方對過時非同步結果的 cleanup 建議處理生命週期；資料還原由使用者選檔事件觸發，沒有改為 Effect 自動寫入。

- https://react.dev/learn/synchronizing-with-effects#fetching-data
- https://w3c.github.io/FileAPI/#dom-blob-text

localStorage 比對後寫入並不是跨分頁鎖定或多個 key 的原子交易。運動／健康資料、影片、裝置偏好仍依序儲存；若主要資料已還原，後續遇到 quota 等儲存失敗，會明確回報哪些部分未完成，請保留原 JSON。既有儲存損壞防護不變，本輪沒有加入損壞儲存自動覆蓋或復原。

新增備份瀏覽器案例另重現 844×390 時固定側欄比視窗高、最下方設定按鈕無法捲入的問題；讓側欄獨立垂直捲動，內容不被 flex 壓縮或互相覆蓋，保留原本直向底部導覽。測試仍透過正常 click 自動捲入點擊，沒有使用 force 或 DOM click 繞過。

完整本機檢查：234 項 Vitest（35 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置及 diff 檢查通過。新增測試覆蓋本機切雲端不產生 outbox、新資料及跨分頁內容變更、取消、卸載、新舊讀取兩種完成順序、確認前後再檢查、壞檔／大檔、影片 quota 部分完成，以及取消後恢復 PWA 更新入口。三種尺寸共 21 個 Playwright 案例，新增真正 JSON 下載、內容比對、拒絕壞檔、取消後保留資料、加入新運動後以相同備份還原；只有虛構本機資料。CI／合併／部署結果追加於本次 PR。

iPhone 手動驗收：設定與備份 → 匯出 JSON 至自己的檔案 App，確認檔案可找到；另加一筆測試運動後選取備份，先取消確認，資料應保留，再選相同檔案並確認，才回復匯出當時內容。若讀取狀態可見，可按取消，稍後不應再出現確認。測試前另存有效備份。本輪沒有需要新增的 Google 手動授權；Safari 檔案選擇、主畫面 PWA 與 VoiceOver 仍待實機，不把 Chromium viewport 當作驗收完成。


## E13：運動歷史搜尋與分批閱讀

運動紀錄頁原本一次呈現所有運動，累積數月後不易找到舊紀錄再記一次。現在預設顯示最新 12 筆，可以每批 12 筆繼續展開；按下後焦點移到首筆新增運動的標題，標題的可及名稱包含日期及種類。重新讀取資料／刪除紀錄保留已展開的數量；修改篩選或清除時回到首批。

關鍵字搜尋備註、日期、中文種類及跑步機標記，空白分隔的多個字詞必須全部符合，不區分英文大小寫，並正規化全形／半形；以文字比對，不把輸入當成正規表示式。可同時選擇 13 種運動之一及起迄日期，起迄均包含，留空一端代表不限制該端。日期區塊預設收合，設定後標示「已設定」。非法或反向日期會說明原因，暫不顯示紀錄且不動原資料；無結果可直接清除篩選。

結果狀態顯示符合條件與目前已展開筆數，總分鐘／熱量依全部符合條件的紀錄計算。分批只限制 DOM 顯示，不截斷資料、備份、雲端 outbox 或上方本週／八週統計；首頁維持最近四筆。所有篩選與展開狀態只存在目前頁面記憶體，離開再回來或換帳號／副本重設，不新增 localStorage key、Google scope、Sheet 分頁或 API。一般雲端資料更新保留檢視範圍；搜尋本身不發送網路請求，離線可篩選目前已讀取的資料。

從符合條件的紀錄編輯、刪除或再記一次，仍以原 ID／物件走既有工作區 callback、權限與草稿流程。雲端暫不可編輯時，篩選仍可使用，寫入按鈕維持停用。這不提供伺服器搜尋或尚未同步資料的查詢，也不改變跨裝置衝突限制。

官方方案參考：W3C 將簡短搜尋結果數量視為 status message，因此只有結果摘要設為 status，整份紀錄不設 live region；React 的 key 用於換工作區時重設局部狀態，Google 面板仍保持掛載；MDN 說明 date input 的值是 yyyy-mm-dd、不含時間，故以既有日期 key 包含邊界比對，避免轉成裝置本地瞬間。保留原生日期輸入、至少 16px 字級及 44px 控制項，未禁止縮放。

- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- https://react.dev/learn/preserving-and-resetting-state
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date

完整本機檢查：246 項 Vitest（36 檔）、8 項 Python、TypeScript／Vite／Service Worker 建置、格式及 diff 檢查通過。新增測試涵蓋多條件交集、包含邊界／單側日期、同日排序、全形／大小寫／字面搜尋、無效與反向日期、首筆新增項目焦點、全部符合條件的總計、重讀／刪除保留批次、條件改變重設、權限停用與換帳號清除篩選且不重掛 Google。三種尺寸共 24 個 Playwright 案例通過；新增 34 筆運動歷史的篩選／分批／再記一次取消／離線重開搜尋與原資料及本週統計不變，並檢查 16px／44px 欄位與不溢出。已檢視 320px 與橫向篩選區截圖，調整清除按鈕為 14px 深色文字；最終建置與瀏覽器回歸再次確認。CI／合併／Pages 結果追加於本次 PR。測試只使用虛構本機與 mock 帳號，沒有登入 Google 或修改私人試算表。iPhone Safari／主畫面 PWA／軟體鍵盤與 VoiceOver 保留實機待驗收。

實機方式：開啟運動紀錄 → 輸入備註或「跑步機」→ 選運動種類 → 展開日期範圍並選起迄日，確認結果數量及總時間；清除篩選後按「再顯示」找到舊紀錄，按「再記一次」應以今天開新草稿，取消後原紀錄不變。旋轉螢幕、日期欄位聚焦及離線重開後重新搜尋，確認不溢出與資料仍完整。本輪沒有新增手動 Google 授權步驟。
