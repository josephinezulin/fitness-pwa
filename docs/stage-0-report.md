# 階段 0：合併、部署與驗收記錄

依 docs/handoff-codex.md，先讓網站支援選用工作表，再升級試算表。五張核心表不改名、不改健康資料，不改分享權限。

## 基線檢查

已執行：npm ci（快取指向工作區）→ npm test → python3 -m unittest discover -s scripts -p 'test_*.py' → npm run build。

結果：98 項 TypeScript／介面測試、6 項 Python 測試通過，TypeScript 與 Vite／PWA 建置成功。新增 PR 專用 CI，避免只有合併到 main 後才執行檢查。

## 合併後驗收清單

- [x] PR #1 已合併為 `4fab158aaf4879883edeabf4022e2fdaad017044`，GitHub Pages 工作流程成功，首頁及新版 JS／CSS 均 HTTP 200。
- [ ] iPhone Safari：新增走路／跑步，填兩段分鐘、km/h、坡度 % 及機台熱量；儲存後可展開，重新開啟仍保留。
- [ ] iPhone Safari：影片縮圖點擊後在頁內播放，直向／全螢幕操作正常。
- [ ] 不允許內嵌／已下架影片：可開啟 YouTube 觀看，不能將無法播放誤標為可用。
- [ ] 在私人測試副本執行 UpgradeFitnessTemplate.gs，重複執行不改既有資料。
- [ ] Videos 新增一列虛構測試影片，TreadmillSegments 新增兩段，workoutId 對應 WorkoutLogs，分鐘四捨五入一致。
- [ ] PWA 以本人 Google 登入選取該私人測試副本，「更新資料」後讀到影片及分段。
- [ ] 舊五表副本仍可讀取；核心表、健康原始資料與分享權限未變。

檢查框只在取得實際證據後勾選。本機 mock 或 YouTube metadata 成功不代表 iPhone 試播／本人 PWA 驗收已通過。

## 階段 C 的一致性設計

交接要求分段和運動紀錄可安全重試。實作前會依 Google 官方文件優先採用同一次 spreadsheets.batchUpdate，將舊分段 tombstone、新分段與 WorkoutLogs 更新一起提交；不使用兩個獨立請求製造分段先成功、主紀錄未成功的可見中間狀態。

revision 的讀前比對不能提供跨裝置的原子 compare-and-swap。會保留本機待同步內容、標示偵測到的衝突，並清楚記錄這項限制；不會宣稱 Sheets 具有資料庫交易或嚴格跨裝置鎖。任何真實雲端寫入仍須使用本人 OAuth 與私人檔案驗證，不公開無驗證的健康 API。
