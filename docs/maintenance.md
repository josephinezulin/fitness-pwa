# 長期維護檢查

調研日期：2026-11-06 UTC。來源皆為上游官方版本、README／action.yml 或 npm 發布中繼資料；版本號只代表本次檢查結果，更新前仍應重查。

## GitHub Actions runtime

自訂課表部署 run 42313475934 成功，但 GitHub 明確提示舊 actions 的 Node 20 runtime 已棄用，改由 Node 24 強制執行。已查各官方 release 的 tag ref、README、action.yml，更新並固定完整 commit SHA：

| Action | 版本 | commit |
| --- | --- | --- |
| checkout | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| setup-node | v7.1.0 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| configure-pages | v6.0.0 | 45bfe0192ca1faeb007ade9deae92b16b8254a0d |
| upload-pages-artifact | v5.0.0 | fc324d3547104276b827a68afc52ff2a11cc49c9 |
| deploy-pages | v5.0.1 | 368f82528645a54fb793d4d04e342629a3f51346 |

JavaScript actions 使用 node24；上傳 Pages 的 composite action 內部已固定 upload-artifact v7 的 SHA。官方最低 runner 為 2.327.1，專案使用 GitHub 託管 ubuntu-latest，以實際 PR CI／Pages 執行確認。應用建置的 Node 版本仍維持 22，與 Action 自身 runtime 分開。

檢查到的相容性：checkout v7 的 fork 防護針對 pull_request_target／workflow_run，本專案使用 pull_request 與 push；不加入 allow-unsafe-pr-checkout。setup-node v7 的 ESM 與 NODE_AUTH_TOKEN 變更不影響本專案的公開 npm 安裝（沒有 registry-url 或私有 npm Token）。保留 cache=npm、既有權限、dist 上傳與 github-pages 環境。checkout 加入 persist-credentials=false，後續步驟無需透過 git 進行認證寫入。

官方 release 與程式來源：

- https://github.com/actions/checkout/releases/tag/v7.0.1
- https://github.com/actions/setup-node/releases/tag/v7.1.0
- https://github.com/actions/configure-pages/releases/tag/v6.0.0
- https://github.com/actions/upload-pages-artifact/blob/v5.0.0/action.yml
- https://github.com/actions/deploy-pages/releases/tag/v5.0.1

驗收須包括 PR 的完整測試／建置、新 workflow 的 Pages build／deploy 成功，以及正式首頁、JS／CSS／Service Worker HTTP 讀回；本機測試不能證明 GitHub Action runtime 可用。部署後可另讀 annotations 確認舊 Node 20 提示已消失。

已驗證結果：PR #9 合併提交 `ce28d33564cca7460d21b88ba3e6784c97f1742b`，PR CI run 42313922331 與 Pages run 42314061084 成功，包含 186 項 Vitest、6 項 Python 及建置；正式首頁、JS／CSS／SW 讀回 HTTP 200。新工作流程的 annotations 沒有舊 Node 20 runtime 提示，保留 GitHub 的 ubuntu-latest image 遷移資訊。

## Recharts 升級調研（尚未升級）

本次 npm 官方發布資訊顯示 latest=3.10.1，要求 Node≥18，peer React／React DOM 包含 19，另有 react-is peer。官方 3.0 migration guide 要求 TypeScript 5.x、React≥16.8，並調整內部 state、Tooltip 型別、元素順序及預設開啟 accessibilityLayer。

目前程式只在 HealthChart 與 WeeklyActivity 使用標準 AreaChart／BarChart、axes、Tooltip；未使用 CategoricalChartState、Customized 或 activeIndex。基本版本門檻符合，但這不等於視覺／觸控相容性已驗證；本輪不更換圖表主要版本。

後續可獨立完成：

1. 升級時固定相容 react-is 版本、檢查 lockfile，依官方變更檢查 formatter 的未定義值與圖層順序。
2. 先提供能閱讀的數值清單／表格，讓 VoiceOver 與不易操作圖表者仍可查看趨勢；缺值與無運動週不可誤標為有測量的零。
3. 加入實際圖表 DOM／鍵盤測試、健康缺值及八週資料回歸，確認正式建置與 PWA precache，再於 iPhone 檢查觸控 Tooltip、縮放、橫向與 VoiceOver。無實機結果時明確保留待驗收。

來源：https://github.com/recharts/recharts/wiki/3.0-migration-guide 。另執行 `npm view recharts@latest version engines peerDependencies --json` 查發布資訊，未修改 package.json／lockfile。

E5 已先在現有 Recharts 2.15.4 補上文字／表格替代、缺值及實際 SVG／鍵盤 DOM 回歸，見 [趨勢閱讀與可及性](trend-accessibility.md)。主要版本升級仍應獨立處理，避免把套件更新與數值語意修正混在一起。
