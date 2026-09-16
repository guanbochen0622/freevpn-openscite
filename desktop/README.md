# OpenScite 電腦版（預覽版）

使用自己的 ChatGPT 帳號登入 Codex，從 PDF 閱讀器進行摘要、選取文字解釋、翻譯、論文問答與圖片分析。不需要填 API 金鑰。這是獨立電腦程式；GitHub Pages 網址仍是網頁版，iPhone 無法安裝此電腦版本。

## Mac 直接安裝（不需指令）

到 [Mac 預覽版下載頁](https://github.com/guanbochen0622/freevpn-openscite/releases) 選擇 DMG：

- `mac-arm64.dmg`：Apple 晶片（M 系列）。
- `mac-x64.dmg`：Intel 處理器。

不確定晶片型號時，可從 Mac 左上角蘋果選單開啟「關於這台 Mac」查看。

打開 DMG，將 OpenScite 拖入 Applications（應用程式），再從應用程式開啟。按右上「ChatGPT 帳號」登入並選擇模型。安裝包已包含執行環境，不需要另外安裝 Node.js。

此預覽版使用臨時簽章，尚未有 Apple 開發者簽章或公證。首次開啟可能被 macOS 阻擋；若你確認來源是本儲存庫，可以依 [Apple 官方說明](https://support.apple.com/zh-tw/guide/mac-help/mh40616/mac)，在「系統設定 → 隱私權與安全性」允許這個 App 開啟。不需要關閉整台電腦的安全保護。

## 從原始碼啟動（開發者用）

在 Windows、macOS 或 Linux 安裝 Node.js 22 或更新版本，下載整個儲存庫並解壓縮。在儲存庫資料夾開啟終端機，執行：

```sh
cd desktop
npm ci
npm start
```

首次安裝需要網路下載 Electron 與官方 Codex 程式。Windows 不需要另外安裝 WSL。不要用系統管理員或 root 執行程式。

## 使用

1. 按右上「ChatGPT 帳號」→「登入 ChatGPT」。
2. 在官方瀏覽器頁面登入自己的帳號，回到程式。若畫面沒有更新，按「重新整理」。
3. 選擇帳號提供的模型和推理強度（預設優先選「中」），按「完成」。
4. 上傳 PDF，使用右側問答、AI 摘要，或選取文字/圖表後分析。
5. 運算中可按頂端「取消 AI」。換人使用前，在「ChatGPT 帳號」按「登出」。

只列出服務回傳的模型，不承諾每個帳號都有 Astra 或相同額度。圖片分析需要支援圖片輸入的模型。帳號受 Codex 訂閱權限與額度限制；ChatGPT 對話記憶不會自動帶進此程式。問答每次依閱讀器提供的相關頁面作答，不會自動把整篇論文或前次回答作為上下文。

## 資料與權限

PDF 閱讀本身在本機進行；按分析時，所需文字與裁切圖片會傳送到 OpenAI。不要在未授權情況下送出機密論文。登入憑證由官方 Codex 儲存在此程式專用的使用者資料目錄，不放進網頁 localStorage，也不傳到作者伺服器。共用同一個作業系統帳號的人仍應登出；各自的作業系統帳號有分開的資料目錄。

分析使用獨立空白工作目錄、唯讀限制，停用 shell、網頁搜尋與遠端外掛；不接受模型要求的工具執行或核准。應用程式只開放限定的登入與分析介面給閱讀器。

## 打包

在要發行的作業系統上執行：

```sh
npm ci
npm test
npm run dist
```

產物放在 `desktop/dist`：Windows 安裝程式、macOS DMG、Linux AppImage。`npm run pack` 只產生未封裝的應用程式目錄。正式販售前仍需簽章、公證、使用者實機登入與 PDF 圖表分析驗收。本預覽版尚未宣稱完成上述驗收。

## 驗證狀態

已成功建置 Linux 未封裝程式目錄，並確認內附 Codex 可執行。已驗證 7 項核心協定模擬測試、網頁語法與原有邏輯測試，以及實際 Codex 0.154.0 的初始化與未登入帳號查詢。Apple 晶片與 Intel 的原生 Mac 建置環境皆已通過視窗啟動、PDF 引擎載入、帳號介面與未登入狀態查詢測試。未使用任何使用者帳號代登入，尚未完成訂閱帳號端到端分析測試。若登入後沒有模型，請確認帳號的 Codex 使用權限；不要填 API 金鑰來繞過登入。

官方整合文件：https://learn.chatgpt.com/docs/app-server
