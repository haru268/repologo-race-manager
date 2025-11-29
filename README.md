# レポチーム対抗生還レース 管理システム

レポチーム対抗生還レースのチームデータとランキングを管理するWebアプリケーションです。

## 機能

- **チームデータ管理**: 以下のチーム情報を入力・管理できます：
  - チーム名
  - 最終獲得金額
  - プレイ時間（分）
  - 最終到達レベル
  - メンバーHP内訳（1チーム最大4名）
- **ランキングシステム**: 以下のランキングを自動計算・表示します：
  - R.E.P.O.マスター賞: （最終獲得金額 ÷ プレイ時間［分］）× 生存HP合計 × 最終到達Lv
  - 資材回収王チーム: 最終獲得金額で順位付け
  - タイムアタック賞: 最終獲得金額で順位付け
- **ランキング表示ページ**: すべてのランキングを表示（アニメーション付き）
- **結果発表ページ**: ランキング発表用のページ
- **自動保存**: すべてのデータがブラウザのローカルストレージに自動保存されます
- **リアルタイム同期**: Firebase Realtime Databaseを使用して、複数のユーザー間でデータをリアルタイムに同期（オプション）

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 本番用ビルド
npm run build
```

### リアルタイム同期機能の設定（オプション）

複数のユーザー間でデータをリアルタイムに同期するには、Firebase Realtime Databaseの設定が必要です。

1. **Firebaseプロジェクトの作成**
   - [Firebaseコンソール](https://console.firebase.google.com/)にアクセス
   - 「プロジェクトを追加」をクリック
   - プロジェクト名を入力して作成

2. **Realtime Databaseの有効化**
   - 作成したプロジェクトを選択
   - 左メニューから「Realtime Database」を選択
   - 「データベースの作成」をクリック
   - 場所を選択（例: asia-northeast1 (Tokyo)）
   - セキュリティルールは「テストモードで開始」を選択（後で設定可能）

3. **Firebase設定情報の取得**
   - プロジェクト設定（⚙️アイコン）→「全般」タブ
   - 「マイアプリ」セクションで「</>」アイコンをクリック（Webアプリを追加）
   - アプリ名を入力して登録
   - 表示された設定情報をコピー

4. **環境変数の設定**
   - プロジェクトルートに `.env` ファイルを作成
   - 以下の形式でFirebase設定を追加：

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

5. **開発サーバーの再起動**
   ```bash
   npm run dev
   ```

6. **使用方法**
   - **デフォルトのルームを使用**: 通常通りアクセス
     ```
     http://localhost:5173/
     ```
   
   - **カスタムルームを使用**: URLの最後に `?room=ルーム名` を追加
     ```
     http://localhost:5173/?room=race-2024
     ```
     または
     ```
     http://localhost:5173/?room=event-001
     ```
   
   - 同じルーム名を使用しているユーザー全員でデータがリアルタイムに同期されます
   - ルーム名は自由に決められます（英数字・ハイフンなどが推奨）

**注意**: Firebaseを設定しない場合、アプリはローカルストレージのみを使用して動作します（既存機能は維持されます）。

## 使い方

1. **データ入力ページ**: チームを追加してデータを入力
   - 「+ チームを追加」ボタンで新しいチームを追加
   - チーム名、最終獲得金額、プレイ時間、最終到達レベルを入力
   - メンバー名とHP値を入力（1チーム最大4名）
   - ランキングは自動計算されます

2. **ランキング表示ページ**: すべてのランキングを表示
   - R.E.P.O.マスター賞、資材回収王チーム、タイムアタック賞のランキングを確認
   - 表示ボタンでランキングをアニメーション付きで表示

3. **結果発表ページ**: 結果発表
   - 最終結果をランキング表示とともに発表

## 技術スタック

- React 18
- TypeScript
- Vite
- CSS Modules
- Firebase Realtime Database (リアルタイム同期機能用、オプション)

## プロジェクト構成

```
src/
  ├── App.tsx              # メインアプリケーションコンポーネント
  ├── types.ts             # TypeScript型定義
  ├── components/
  │   ├── RankingPage.tsx  # ランキング表示ページ
  │   └── AnnouncementPage.tsx  # 結果発表ページ
  └── utils/
      ├── storage.ts       # ローカルストレージユーティリティ
      ├── firebase.ts      # Firebase Realtime Database ユーティリティ
      └── teamUtils.ts     # チーム計算ユーティリティ
```
