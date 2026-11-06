# 用 Mac 準備可匯入 iPhone 的捷徑

目前沒有已簽署的匯入檔。Mac 可使用 Apple 官方 `shortcuts sign`，但仍需要準備正確的動作格式，並在使用者的 Mac / iPhone 實測。開發環境是 Linux，沒有連接使用者的 Mac，也無法代替使用者完成 Apple 的簽署。

## 先沿用已成功讀取健康資料的捷徑

為避免猜測不同 iOS 版本的 Health 動作參數，請把現有「能取得體重、體脂、步數」的捷徑匯出：

1. 在 iPhone 捷徑 App 打開該捷徑的編輯畫面。
2. 點名稱旁的選單或分享按鈕，選「輸出檔案／Export File」；名稱依 iOS 版本略有不同。也可使用「複製 iCloud 連結」分享動作範本。
3. 將 `.shortcut` 檔案提供給開發流程，不需要提供健康資料的執行結果。檔案內若已有 Token、私密上傳網址參數或硬編碼的個人健康值，先移除；上傳前的共用版本保持不含秘密。

開發流程會檢查是否能讀取匯出格式，保留已驗證的 Health 動作，補上資料整理、批次及錯誤處理。若檔案容器無法直接解析，先回報，不把未驗證的 plist 偽裝成可匯入捷徑。

## API 必須先有實際部署網址

上傳端程式位於 `apps-script/HealthIngest.gs`，部署步驟見 `docs/health-ingest-setup.md`。完成私人測試部署後，提供 `/exec` 網址即可；裝置 Token 不交給開發流程，只在自己匯入的捷徑填入。

捷徑需要組合出 API v1 的 JSON：最近七天體重／體脂樣本，以及核對過的 iPhone 每日總步數。重試沿用同一 requestId，新批次用新 requestId。Body 包含裝置 ID 與 Token，URL 不帶秘密。

## 原始檔準備完成後，在自己的 Mac 簽署

以下為未來取得未簽署檔案後的命令範例；目前尚未提供該檔案，先不要執行：

```sh
shortcuts sign --mode anyone \
  --input "$HOME/Downloads/日常動作-同步-未簽署.shortcut" \
  --output "$HOME/Downloads/日常動作-同步.shortcut"
```

Apple 簽署會驗證捷徑內容，因此共享原始檔及簽署階段不嵌入實際裝置 Token；匯入後才在自己的捷徑填入。簽署完成後可透過 AirDrop 或自己的檔案傳到 iPhone，再點開匯入。

最終仍需本人在 iPhone 核准健康讀取、確認網路存取、核對體脂單位與每日步數，並設定個人每日自動化。Mac 簽署成功不等於 iPhone 執行成功。

官方說明：https://support.apple.com/en-gb/guide/shortcuts-mac/apd455c82f02/mac
