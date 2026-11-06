# 交接文件：運動紀錄、跑步機分段、影片庫與雲端擴充

分支：feature/exercise-videos-treadmill（尚未合併 main，尚未開 PR）
檢查指令：npm ci && npm test && python3 -m unittest discover -s scripts -p 'test_*.py' && npm run build
目前狀態：98 項測試通過，建置成功。

## 一、已完成

### Commit 1：運動類型、跑步機分段、影片庫（本機）

- src/model.ts
  - WORKOUT_TYPES：13 種運動（home, strength, jumprope, walk, run, cycling, swim, hike, yoga, pilates, stretch, ball, other），含分組與 treadmill 旗標（只有 walk、run 為 true）。
  - Workout 新增選用欄位 segments: { minutes, speed, incline }[]；SEGMENT_LIMITS 定義範圍（分鐘 0.5–300、速度 0.5–25 km/h、坡度 -5–40 %、最多 50 段）。
  - treadmillSummary()：總時間、總距離、時間加權平均速度與坡度、最高速／坡、估算爬升（下坡不計）。
  - validate()：有 segments 時，minutes 必須等於分段總和（容差 0.05），且類型必須是 walk 或 run。舊備份不受影響。
  - demo() 新增一筆跑步機範例。
- src/WorkoutForm.tsx（新）：運動表單改為受控元件，依分組顯示類型；walk、run 可勾選「使用跑步機」，逐段輸入，可新增或複製段落，即時顯示統計。
- src/videos.ts（新）：29 支內建影片（11 個分類）、parseYouTubeId()、自訂清單存 localStorage（key：daily-movement-videos-v1）、新增、移除、隱藏內建影片。
- src/VideoLibrary.tsx（新）：運動影片頁，分類篩選；點縮圖後以 youtube-nocookie.com iframe 在頁內播放。
- src/main.tsx
  - 導覽列新增「運動影片」頁。
  - 運動紀錄頁新增本週總覽，跑步機紀錄可展開分段明細。
  - 本週課表頁的 YouTube 搜尋連結改為跳到對應影片分類。
  - JSON 備份匯出與還原包含自訂影片。
- src/style.css：新元件樣式，已在 390px 手機寬度檢查。

### Commit 2：Google Sheets 讀取擴充（以雲端為主）

- src/sheet-schema.ts
  - 新增選用分頁 TreadmillSegments、Videos；schema 版本仍為 1，舊副本照常通過。
  - TAB_NAMES 維持 5 張必要分頁；新增 OPTIONAL_TABS、ALL_TABS。
  - 類型檢查改用 isWorkoutType。
  - 分段交叉檢查：workoutId 必須存在、僅限 walk 或 run、seq 不可重複、分段總和四捨五入需等於 WorkoutLogs.minutes。
  - 兩張選用分頁的 updatedAt 可留白，方便手動輸入。
- src/sheets.ts：允許 5 張必要分頁加上選用分頁，其他工作表一律拒絕；只讀取實際存在的分頁。
- src/cloud-data.ts：把分段掛到對應運動（minutes 改用分段精確總和）；Videos 投影到 Data.videos。
- src/model.ts：Data 新增選用欄位 videos（SheetVideo[]）。
- src/VideoLibrary.tsx：雲端模式合併試算表影片，標示「試算表」，同一支影片只列一次，App 內不可刪除試算表影片。
- apps-script/UpgradeFitnessTemplate.gs（新）：升級既有副本。先全部檢查，確認無誤才修改；只新增缺少的分頁、更新 type 下拉選單；不改資料與分享權限，可重複執行。
- apps-script/CreateFitnessTemplate.gs：新範本直接建立 7 張分頁與 13 種類型下拉選單。
- apps-script/HealthIngest.gs：原本規定剛好 5 張分頁，改為允許選用分頁（HEALTH_OPTIONAL_TABS）。
- 測試：model、videos、sheet-schema、cloud-data、sheets、health-ingest、template-script（含升級腳本 mock）。
- 文件：README.md、docs/sheets.md、docs/sync-progress.md、docs/gemini-template-prompt.md。

## 二、尚未驗證（需使用者實機操作）

1. 內建影片 ID 來自網路搜尋，開發環境無法連到 YouTube。部分影片可能不允許嵌入，需在 iPhone 實際試播，無法播放的就移除或替換。
2. UpgradeFitnessTemplate.gs 只在 mock 環境測過，需在真實試算表執行一次。
3. 部署順序：先合併並部署網站，再執行升級腳本。舊版網站看到 7 張分頁會判定格式不符。

## 三、接續計畫

### 階段 0：合併前（小）

- 開 PR，從 feature/exercise-videos-treadmill 合併到 main；PR 需附上試播與升級的驗收清單。
- 驗收：使用者升級試算表，在 Videos 分頁填一列、在 TreadmillSegments 填兩段，網站「更新資料」後能正確顯示。

### 階段 C：開放雲端寫入（大，優先）

目標：在網站新增、編輯、刪除運動紀錄（含分段）與影片，寫回使用者自己的試算表。

1. 權限：目前 OAuth scope 為 drive.file，Picker 選取的檔案已可寫入。需確認 Sheets API values.append 與 batchUpdate 在此 scope 下可用，並更新 docs/security.md。
2. 寫入層（新檔 src/sheets-write.ts）：
   - 使用 values:batchUpdate 或 append，valueInputOption=RAW，避免公式注入。
   - 以 = + - @ 開頭的文字需逃逸，並加測試。
   - 寫入前重新讀取並比對 revision，沿用 src/sync-rules.ts 的 planWorkoutChanges。
   - 必須把 segments 納入 workoutFields 的比較（目前未納入）。
   - 刪除採 tombstone（填 deletedAt），不實際刪列。
3. 運動與分段一致性：
   - 寫一筆運動時，同時寫 WorkoutLogs（minutes 取分段總和四捨五入成整數）與 TreadmillSegments（每段一列，seq 從 1 開始）。
   - 編輯分段時，舊分段填 deletedAt，再新增新分段，避免列序錯亂。
   - Sheets 沒有交易：先寫分段，再寫或更新 WorkoutLogs，失敗時可以重試並以 id 冪等。必須有測試。
4. 影片寫入：在 Videos 分頁 append；刪除填 deletedAt。雲端模式下，App 內「新增影片」改寫入試算表。
5. 離線 outbox：斷網時把待寫入項目暫存在 localStorage，以 subject + spreadsheetId 分區，恢復連線後重送；UI 顯示同步狀態與衝突。
6. UI：雲端模式下解除表單與按鈕的 disabled（main.tsx 中所有 disabled={!!workspace.cloud}）；useWorkspace.save 改為寫入雲端。
7. 測試：寫入請求格式、revision 衝突、部分失敗後重試、公式字串、帳號切換時取消待寫入。

### 階段 D：體驗優化（中）

1. 熱量估算：跑步機使用 ACSM 公式（以速度、坡度、體重計算），其他運動使用 MET 表。體重取健康數據最新一筆，可手動覆寫。
2. 跑步顯示配速（分/公里）。
3. walk 類型預設勾選「使用跑步機」。
4. 分段錯誤訊息具體化（例如總時間不足 1 分鐘、哪一段超出範圍）。
5. 影片播放器加「完成，記錄這次運動」，自動帶入類型與分鐘數（需要影片分類對應運動類型的表）。
6. 跑步機範本：常用分段組合一鍵帶入。雲端可另存選用分頁 TreadmillTemplates，需同步更新 schema、升級腳本與測試。
7. 運動趨勢圖：每週分鐘、距離、平均坡度。
8. 首頁「本週運動 x / 3 次」改為每週 150 分鐘的進度條（目標值可設定）。
9. 影片收藏與看過次數。

### 階段 E：長期

- 課表可自訂：目前 model.ts 的 plans 寫死，應改讀 WorkoutPlans 分頁並可編輯；sheet-schema.ts 對 3 筆預設課表的硬性檢查需放寬。
- 拆分 src/main.tsx（約 1000 行），將各頁面抽成獨立元件。
- PWA 快取 i.ytimg.com 縮圖（workbox runtimeCaching），離線時仍能顯示清單。

## 四、注意事項

- 任何 schema 變更需同步修改 4 處：src/sheet-schema.ts、apps-script/CreateFitnessTemplate.gs、apps-script/UpgradeFitnessTemplate.gs、apps-script/HealthIngest.gs（只限分頁清單），並更新 template-script.test.ts 與 health-ingest.test.ts。
- 運動類型清單在 model.ts（WORKOUT_TYPES）與兩支 .gs 腳本各有一份；template-script.test.ts 會比對三者是否一致。
- 影片分類清單在 videos.ts（VIDEO_CATEGORIES）與兩支 .gs 腳本各有一份。
- 不要把健康資料、Token 或私密憑證寫入 repo；測試資料必須是虛構值。
- 依專案慣例，介面與文件使用繁體中文。
