# Gemini Playwright Mock DOM tests

## 実行

Node >=20、Playwright 1.63.0（ChatGPTと同じ）、bundled Chromiumを使用する。
実測環境はWindows、Node 22.16.0。Mac/Linux実機は未検証。

```powershell
npm ci
npx playwright install chromium
npm run test:unit
npm run test:browser
npm run test:all
```

既存package.jsonはなかったため新設した。npm test / test:unitは従来の3スクリプトを順番に実行する。
既存テストのソース・assertは変更していない。

| スクリプト | トップレベル検証グループ |
| --- | --- |
| tests/local_logic_test.js | 4: MAIN bridge、content logic、manifest scope、locales |
| tests/google_ai_mode_test.js | 4: content、worker、popup、manifest |
| tests/service_controls_test.js | 7: current Flow、static services、popup、availability、worker、permission completion、manifest/locales |

合計3スクリプト・15グループ。独自assert方式であり、個別case件数を集計していない。
ループ内assertを「テスト件数」へ換算しない。追加Browserは35件。
2026-10-06のtest:allは全PASS、Browserはその後3回連続で35/35、計105/105 PASS。
retry=0、workers=1、固定sleepなし。

## 調査時点

main、HEAD d3462e77db5d94f25b50e55b745a13a98542cb15、manifest 1.6.5、開始時clean。
package/lockfileなし。静的content scriptはcontent_script.js、labs FlowのMAIN worldはflow_main_world.js。
Google Chatだけall_frames:true。service_worker.jsはoptional hostの動的登録・状態通知を管理する。
google_ai_mode.js / google_flow_current.jsが動的script。
popup.html / popup.jsはstorageへmaster、mode、サービス設定を保存し、
利用者の明示操作でchrome.permissions.requestを呼ぶ。
content.jsは存在するが現manifestとpopupの注入対象ではない。

本番permissionsはstorage / activeTab / scripting。host_permissionsなし。
optional_host_permissionsはhttps://www.google.com/* と https://flow.google.com/*。
本番manifest・version・権限・content scripts・worker・popupは変更しない。

## DOM契約とスコープ

以下は既存コード・unit・Git履歴から確認した契約であり、実サイトの現在DOMを採取したものではない。
A=今回fixture化、B=DOM契約は確認できるがブラウザ連携は追加調査、C=fixtureで再現を主張しない。

| サービス | URL・DOM・安全判定 | 分類 |
| --- | --- | --- |
| Gemini | gemini.google.com、div[contenteditable=true][role=textbox]。イベント対象のform/限定祖先内でbuttonをlabel/type/jslog/距離等から採点。同点に近い候補は送信しない。body/html/mainはrootにしない | A |
| Notebook | notebook.google.com / notebooklm.google.com、textarea.query-box-input。form内.message-containerにtextarea/buttonが各1つ、対象focus。source-discovery-query-box、query-box-textarea、discoverSourcesQuery、actions-enter-button等を除外 | A、両hostname正常系 |
| Google Chat standalone | chat.google.com、c-wiz[data-is-room-compose-postbar=true][role=region]内textbox[contenteditable=true][aria-multiline=true][g_editable=true]。button[jsname=GBTyxb]が一意、ssKfee予約送信を除外。候補リスト/aria-activedescendant中は非介入 | A |
| Chat埋込frame | chat.google.comかつtopと別frame、jsname=yrriReのeditor、限定祖先探索。all_frames:true | B、frame単位の注入は未検証 |
| 旧Flow | labs.google/fx/*のうち/tools/flow/を含むpath。Slate editor、arrow_forward等のsignal。MAIN world橋渡し、trusted native event/React handler、stop判定、送信lock | B、MAIN/ISOLATED bridgeの追加検証が必要 |
| 現Flow | https://flow.google.com/project/<id>、flow-base-prompt-box内flow-rich-text-editorと.ProseMirror[contenteditable=true]、editor/button[type=submit]各1つ。Shiftのみ、実キーの既定動作をbuttonへfocus handoff | B、optional grant/登録/worker stateとtrusted activationの検証が必要 |
| Search AI Mode | https://www.google.com/search、udmが一つだけで50。maxlength=8192のtextareaとbutton[data-xid=input-plate-send-button]、祖先上限6、dialog/combobox除外 | B、optional grant/登録/worker stateとの統合が必要 |
| 実Flow送信受付・Google認証・native OS IME | isTrusted受理、React/ProseMirror内部、サーバー応答、OS入力 | C |

Flowのmock button click成功で本番送信互換性を保証しない。旧MAIN方式と現native handoff方式も混同しない。
実サイトのisTrusted受理等はProduction DOM/実機確認の責務で、今回はアクセスしない。
FlowとAI Modeの既存unitはすべて維持する。
実Google UIのrollout差・アカウント別UI差・将来のDOM変更への互換性も、このfixtureでは保証しない。

## ハーネスと通信

ChatGPT版のpersistent context、headless、bundled Chromium、実コードの一時コピー、
新規profile、localhost fixtureという考え方を再利用する。

Geminiはlocation.hostnameでサービスを判定するため、単純なlocalhost matches置換では動作しない。
論理URLだけは対応hostnameを維持し、context.routeがHTML/JS/CSSを127.0.0.1の
ランダムポートにあるfixture serverのバイト列でfulfillする。
Google向けroute.continue/route.fetchは存在しない。
許可したhost/path/GET以外はabortしてテストを失敗させ、外部DNS解決も遮断する。
background networking/proxyを無効化し、CSPはconnect/form/workerを禁止する。
実サイトへの要求は送信せず、実通信はloopbackのみ。依存導入時だけnpm/CDN接続が必要。

公開用content script、MAIN script、worker、popup、icons/localesをそのまま一時拡張へコピーする。
実workerからchrome.storage.localへ非機密設定を投入する。optional権限は要求せず、
両originが個別に未許可であることを毎回検証する。optional許可フローのブラウザ検証ではない。

一時manifestに限りISOLATED script直前へsettings-observer.jsを追加し、
unknown.invalidをサービス不明の負例用に追加する。本番manifestは読み取りのみ。
observerは実chrome.storage.local.get(null, callback)のcallback完了をDOM属性へ記録する。
値も本番callbackの内容も変更せず、APIを元へ戻す。固定sleepではなく実際の設定読込完了を待つための観測である。

page.jsはページ側の最小編集契約のみ。届いたShift+EnterでinsertLineBreakを行う。
設定shortcut、composer選択、送信安全判定は実装しない。
送信は実content scriptのbutton.clickをdocumentで数える。動的追加buttonも計測対象。
素のEnterはnativeEntersに記録するだけで、代替送信処理は持たない。
OFFの負例ではtrustedキーがページまで届き、拡張clickが0回であることを確認する。
ONではEnter後first\nsecond、送信0回、shortcut後click厳密に1回を要求する。

JS例外・console error・想定外要求・Cookieを検査する。全testで新規profileとstorage初期化を行う。
finallyでcontext/serverを閉じ、一時拡張/profileを削除する。強制プロセス終了時の残存は別途確認が必要。
screenshots/video/traceはoff。node_modulesとテスト成果物はGit対象外。
同期はlocator/expect.pollで観測可能な状態を待つ。固定sleepやretryによる失敗の隠蔽はしない。

## fixture一覧と期待

| HTML | 内容 |
| --- | --- |
| gemini | 正常、Shift/Ctrl/Both両キー/Combo、button disabled/aria-disabled/hidden/feedback、master/service OFF、composition |
| gemini-no-input | 入力欄なし、送信0 |
| gemini-no-send | 改行維持、送信0 |
| gemini-two-send | 近いスコアの送信候補二つ、送信0 |
| gemini-unknown-root | selector一致でも広いmain直下は送信0 |
| gemini-hidden-only | display:noneのeditorはfocusできず、bodyのキーで送信0 |
| gemini-stale-valid | hidden formと有効form。focusした有効側だけclick |
| gemini-two-composers | 二つの可視formで、focusした各composerのbuttonを個別にclick |
| notebook | 両hostname正常系、service OFF、buttonなし/複数/disabled |
| notebook-two-inputs | 同一containerにtextarea二つ、送信0 |
| notebook-source | source-discovery-query-box配下は非介入 |
| chat | 正常、service OFF、buttonなし/複数/disabled、候補選択中の非介入 |
| chat-unknown-root | composer属性不一致で非介入 |

Geminiはページ全体のeditor一意性を要求しない。複数入力を勝手にFAIL扱いしない。
hidden-onlyはfocus不可の確認であり、合成キーへの防御保証ではない。
現Geminiの可視性判定はgetClientRects().lengthなのでopacity=0/0サイズの一律除外も保証しない。
fail closedは拡張が曖昧な候補をclickしない意味で、ホスト自身の全送信禁止ではない。

サービスON/OFFは保存設定をページ読込前に投入する。読込後の切替・古い非同期処理の取消は
既存service_controls_test.jsが担当する。Mac cmd/shiftCmdもunitに残す。
compositionstart/endとtrustedキーでは送信0・ページへキーが届くことを確認する。
native IMEを模したものではなく、確定文字列不変、229、80ms境界を保証しない。
初回は文字列不変という誤った期待で1件失敗したが、非介入を直接観測する期待へ修正した。

## 過去回帰

修正commit 9c33a52a97d41b2a9c46b2f4fb32f1e24b32cadeはNotebookの
button.submit-button[type=submit]依存をmessage-container内の一意buttonへ変更した。
同じ契約は既存unitにもある。2026-10-06、一時コピーで以下を実測した。

- 現在コード + notebook fixture: PASS。
- 直前commit 22bda5bff434a7ac88de9f0232495bf72b8354e5（manifest 1.6.2）の
  content_script.jsだけを差し替え: 改行PASS、Shift+Enterのclicks=[]（期待['send']）でFAIL。
- 他のmanifest/worker/helperは現行。旧拡張全体の再現ではなく送信selector回帰の比較。
- 一時コピー・失敗artifactは削除。本番コードとGit履歴は変更していない。

## Oopsへの次工程

Oops config/CIは今回変更しない。将来の設定候補:

```json
{
  "tests": {
    "unit": {
      "command": ["npm", "run", "test:unit"],
      "timeout_seconds": 60
    },
    "browser": {
      "command": ["npm", "run", "test:browser"],
      "timeout_seconds": 180
    }
  }
}
```

npm ci/Chromium installはCIのsetup責務とし、Runner中には導入しない。
PlaywrightをChatGPTと揃えているため、同一Windows jobへの配置を想定できる。
正式commit/push後に検証済みSHAをOops CIへ登録し、実runで確認する。
Mock DOM成功はStore公開承認やFlowの本番互換性の証明ではない。
