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

## 下一個可交付部分

- 拆分 main.tsx 各頁，保留根層 Google Session、outbox、帳號切換取消與草稿生命週期。
- 自訂 WorkoutPlans 的讀寫。先定義相容舊備份的可選 plans 投影，分開處理「缺少舊資料時的預設」與「使用者停用全部課表」。放寬三筆預設課表的硬性驗證時，同步檢查四份 schema／腳本及測試。
- 同日同類型多課表的打卡語意需先解決，不能讓一筆紀錄無意間完成多個重複目標；可先限制同一 weekday/type 只能有一個啟用課表，避免增加不相容的 WorkoutLogs 欄位。
- 自訂課表的雲端更新沿用私人檔案閘門、明確型別、outbox、衝突及同源編輯鎖，不增加廣域 OAuth scope。

未把尚未實作的自訂課表或程式拆分列為完成。回來先檢查 PR／部署與使用者回報，保護其他工作階段的修改。
