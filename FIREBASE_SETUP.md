# Firebase リアルタイム同期設定ガイド

このアプリはFirebase Realtime Databaseを使用して、複数のユーザー間でデータをリアルタイムに同期できます。

## セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebaseコンソール](https://console.firebase.google.com/)にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `repologo-race-manager`）
4. Googleアナリティクスの設定は任意
5. 「プロジェクトを作成」をクリック

### 2. Realtime Databaseの有効化

1. 作成したプロジェクトのダッシュボードを開く
2. 左メニューから「**Realtime Database**」を選択
3. 「**データベースの作成**」をクリック
4. データベースの場所を選択（推奨: `asia-northeast1 (Tokyo)`）
5. セキュリティルールを選択：
   - **開発中**: 「テストモードで開始」を選択（全員が読み書き可能）
   - **本番環境**: 後述のセキュリティルールを設定

### 3. Webアプリの登録

1. プロジェクト設定（⚙️アイコン）→「**全般**」タブ
2. 「**マイアプリ**」セクションまでスクロール
3. 「**</>**」アイコン（Webアプリを追加）をクリック
4. アプリのニックネームを入力（例: `Race Manager Web`）
5. 「このアプリでFirebase Hostingも設定しますか？」はチェック不要
6. 「**アプリを登録**」をクリック

### 4. 設定情報のコピー

登録後、以下のような設定情報が表示されます：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

この情報をコピーします。

### 5. 環境変数ファイルの作成

プロジェクトのルートディレクトリに `.env` ファイルを作成し、以下の形式で記入：

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

**重要**: `.env` ファイルは `.gitignore` に含まれているので、GitHubにはアップロードされません。

### 6. セキュリティルールの設定（推奨）

本番環境では、適切なセキュリティルールを設定してください：

1. Firebaseコンソールで「Realtime Database」→「ルール」タブを開く
2. 以下のルールを設定：

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

このルールでは、すべてのルームが読み書き可能です。より厳格なルールが必要な場合は、Firebase Authenticationを追加で設定してください。

### 7. 開発サーバーの起動

```bash
npm run dev
```

ブラウザでアプリを開くと、ヘッダーに「🔄 リアルタイム同期中」という表示が現れます（Firebaseが正しく設定されていれば）。

## 使用方法

### デフォルトルーム

通常通りアクセスすると、`default` ルームに接続されます。同じルームにアクセスしているユーザー全員でデータが同期されます。

### カスタムルーム

URLに `?room=ルーム名` を追加することで、カスタムルームを使用できます：

- 例: `http://localhost:5173?room=race-2024`
- 例: `https://your-domain.com?room=event-001`

同じルーム名を使用しているユーザー同士でデータが同期されます。

### 同期の動作

- 誰かがデータを入力・変更すると、同じルームにいる全員のブラウザに**即座に反映**されます
- 変更は自動的にローカルストレージにも保存されます
- Firebaseが設定されていない場合、アプリはローカルストレージのみで動作します

## トラブルシューティング

### リアルタイム同期が動作しない

1. `.env` ファイルが正しく作成されているか確認
2. 環境変数の値が正しいか確認（特に `VITE_FIREBASE_DATABASE_URL`）
3. 開発サーバーを再起動（環境変数の変更には再起動が必要）
4. ブラウザのコンソールでエラーメッセージを確認
5. Firebaseコンソールでデータベースが正しく作成されているか確認

### セキュリティルールエラー

- Firebaseコンソールで「Realtime Database」→「ルール」を確認
- テストモードで開始している場合は、読み書きが可能なはずです
- エラーが続く場合は、ルールを一時的に緩和してテストしてください

## 無料プランの制限

Firebaseの無料プラン（Sparkプラン）には以下の制限があります：

- 同時接続数: 100接続
- 保存容量: 1GB
- 転送量: 10GB/月

通常の使用では十分ですが、大規模なイベントでは注意が必要です。

## その他

- Firebase設定を行わなくても、アプリはローカルストレージのみで正常に動作します
- リアルタイム同期は完全にオプション機能です

