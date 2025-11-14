# GitHubへのアップロード手順

## 方法1: Gitコマンドを使用（推奨）

### 1. Gitのインストール
- https://git-scm.com/download/win からGit for Windowsをダウンロード・インストール

### 2. GitHubリポジトリの作成
1. https://github.com にログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `multi-stream-viewer`）
4. 「Create repository」をクリック

### 3. ローカルでGitリポジトリを初期化
```bash
git init
git add .
git commit -m "Initial commit: マルチ配信ビューア"
```

### 4. GitHubリポジトリに接続
```bash
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git branch -M main
git push -u origin main
```

## 方法2: GitHub Desktopを使用

1. https://desktop.github.com/ からGitHub Desktopをダウンロード・インストール
2. GitHub Desktopを開いてログイン
3. 「File」→「Add Local Repository」でこのフォルダを選択
4. 「Publish repository」をクリックしてGitHubにアップロード

## 方法3: GitHub Webインターフェースで直接アップロード

1. https://github.com にログイン
2. 新しいリポジトリを作成
3. 「uploading an existing file」をクリック
4. このフォルダ内のファイルをドラッグ&ドロップでアップロード

