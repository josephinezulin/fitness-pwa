# 活動環首頁改版交接

使用者於 2026-11-09 指定接續 redesign/ring-dashboard，原 head `935cee6`，原參考退版點 `403e7a2`。接手時 main 已前進至 `cdaf990`（PR #39），這輪保留新版首頁、毛玻璃、動畫、分類與個人跑步機範本，同時整合新 main 的安全與資料保護；沒有重設 main。

## P0：合併及部署

- 已解決 App、CloudPanel 及測試的合併衝突，保留首次登入自動選表、選表立即套用及下次登入重讀，以及 E30 重讀套用、E31 運動／E32 影片草稿保護。
- 瀏覽器測試改走新首頁／紀錄／影片導覽及頭像設定入口；Google 登入後首次 Picker 自動開啟，重開則經歡迎頁登入恢復，不增加確認按鈕。
- 本機 404 項 Vitest（42 檔）、8 項 Python、正式建置、Prettier／diff 與完整 87 個 Playwright（4.6 分鐘）通過。PR #40 的 CI 42539861342（job 128912149006）及 Pages 42540260254（build 128913387620／deploy 128914673493）均成功，兩者亦完整通過 404／8／87；使用者指定的兩種下載案例在三個尺寸均包含於完整案例，沒有略過。
- 已合併為 main `d42c4478c56dce4f7aa441076553648eda1dbc80`；正式首頁、JS index-BpVuTxLm.js、CSS index-NlWlSS2v.css 與 SW 均 HTTP 200，JS／CSS SHA 與已測產物相同，SW 已預快取，沒有虛構 worker 標記。這是 P0 證據，不能當作後續 P1 已部署。
- 不改 Google OAuth scope、私人檔案驗證、記憶體 Token、Sheets 原子批次與 outbox，不將測試資料或健康資料公開。

合併後本人需完成：

1. 在自己的 Apps Script 使用新版 apps-script/UpgradeFitnessTemplate.gs，執行 `upgradeFitnessTemplate`，讓 Videos 的驗證清單包含床上運動、坐姿運動、減脂燃脂。不得把私人表改公開，亦不需提供 Token。
2. iPhone Safari／主畫面 PWA 實機確認登入、下次登入自動讀表、YouTube 內嵌播放、毛玻璃與動畫流暢度。Chromium／模擬 Google 測試不等同這些本人驗收。

## P1：功能與本機驗證完成，發布追蹤見本輪 PR

- 歡迎頁：登入失敗／取消選表顯示關聯登入按鈕的 alert，可重試；已有有效 session 時只重開 Picker。SDK 準備失敗可重試準備，成功後仍需本人再點登入，不在非同步回呼偷開 OAuth。保留原 abort／epoch／到期、私人檔案與格式檢查。
- 離線：頭像旁 44px 雲朵斜線可點開帳號說明，區分本機可用與雲端待同步；移除左側舊 icon 及重複離線提示列。Escape 回原入口，恢復連線後入口消失則回頭像。
- 成功動畫：運動、健康、影片、課表及每週目標儲存接受後，以約 0.32 秒勾選 icon 回饋再關閉表單，沒有可見成功文字，保留輔助閱讀名稱。等待時阻擋重複提交、卸載取消晚到關閉，inline 取消可重開；減少動態效果直接完成。接受代表本機／outbox 已接收，原同步狀態照常，並不表示已上傳。
- 今天卡推薦：本機納入自訂影片、雲端納入目前副本 Videos，合併內建並去重；雲端不混入本機自訂，隱藏、分類、10 分鐘內與優先未看過規則保留，未標長度不參與短片推薦。首頁唯讀監聽清單更新，不寫儲存區；更新或看過狀態改變時保留正在播放的 iframe，按「換一個」才切換。交接第 6 點後半段未提供，採先前已告知的工作區候選來源假設。

## 已保存的其他工作

E33 原保存分支 fix/weekly-goal-conflict `bfc7913` 的修正已接回本輪活動環 WeeklyGoal：固定開啟時基準及 input 預設，外部新值保留草稿、阻擋儲存與直接 submit，取消重開採新值；寫入前比對最新目標，漏掉事件仍不覆蓋。不改收藏／觀看最新值。這不是 Web Storage 原子 compare-and-swap；原分支沒有單獨 PR，最終發布以本輪 PR 為準。

官方無障礙依據（2026-11-09 實際讀取）：W3C C39 建議依 prefers-reduced-motion 抑制動態效果；新版沿用 MotionConfig reducedMotion=user，瀏覽器回歸以 reduce 執行。Motion 官網文件請求回覆 403，未將其列為已讀依據。

- https://www.w3.org/WAI/WCAG22/Techniques/css/C39

## P1 驗證與官方依據

新增元件／hook 測試覆蓋歡迎頁 alert、SDK 準備與登入／Picker 重試、離線焦點、儲存接受／減少動態／卸載、影片候選及播放保留、唯讀清單損壞／恢復，以及 E33 畫面與寫前檢查。瀏覽器新增六種情境，各跑三尺寸；Google 使用虛構 SDK／GET 路由，外部影片被隔離，沒有使用真實健康資料或 Token。

定向瀏覽器初跑發現測試 initScript 在外部 iframe 存取 localStorage 被拒；補測試來源 origin 篩選，沒有隱藏應用錯誤或改網站跨來源權限。第一次完整回歸亦找出共用 reloadOffline helper 仍等待已移除的舊提示列；改確認新的具名離線入口，保留真實 SW controller／斷網重載及各案例原有資料完整性斷言。修正後重跑完整案例，沒有略過失敗案例。完整結果通過後記錄於下方與 PR。

2026-11-09 實際讀取 Google Token Model（HTTP 200）：requestAccessToken 由使用者手勢觸發；SDK 準備重試不等同登入。W3C C39（HTTP 200）支持減少動態效果，WHATWG Web Storage（HTTP 200）明載不得假設有鎖；E33 只保護已觀察及寫前讀到的目標變更。

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://html.spec.whatwg.org/multipage/webstorage.html

本人快速測試：歡迎頁取消登入／選表後直接看到錯誤並可再試；切飛航模式點雲朵斜線；新增運動看勾選後關閉，減少動態效果開啟時直接關閉；在目前資料來源新增 10 分鐘內的輕鬆分類影片後回首頁查看；兩分頁同時開目標，後存的舊草稿需先取消重編。原本登入／試算表升級／YouTube／Safari 動畫實機清單仍需本人操作。

定向驗證：424 項 Vitest（45 檔）、8 項 Python、正式建置與三尺寸新增 18 個 Playwright 案例已通過；已目視 320px／390px 的虛構本機離線面板，沒有將 Chromium 截圖當作 iPhone 效能驗收。

最終本機檢查：npm ci、424 項 Vitest（45 檔）、8 項 Python、TypeScript／Vite／Service Worker 正式建置、瀏覽器型別檢查、Prettier 與 git diff --check 通過。修正共用離線 helper 後，完整 105 個 Playwright 案例（5.0 分鐘）通過，沒有略過；包含兩種下載各三尺寸、18 個新增案例與既有真實 worker／草稿／離線回歸。JS index-B0cH8DSr.js、CSS index-CE_ePMQj.css 不含模擬 Google／Token／無效欄名／worker 標記或舊首頁確認文字。實際 PR CI、合併 SHA、Pages 及正式資產比對證據追加於本輪 feature/redesign-followups → main 的 PR，接續時先查該 PR，不能僅憑本機通過宣稱部署。
