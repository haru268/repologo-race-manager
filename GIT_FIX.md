# Gitエラーの解決方法

## よくあるエラーと解決方法

### エラー1: SSH認証エラー
`git@github.com` を使っている場合、SSH鍵の設定が必要です。

**解決方法: HTTPSを使用**

```bash
# 既存のリモートを削除
git remote remove origin

# HTTPSでリモートを追加
git remote add origin https://github.com/haru268/-.git

# プッシュ（認証が求められます）
git push -u origin main
```

### エラー2: 認証エラー（HTTPS使用時）

**解決方法1: Personal Access Tokenを使用**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" をクリック
3. 必要な権限を選択（repo）
4. トークンをコピー
5. プッシュ時にパスワードの代わりにトークンを入力

**解決方法2: GitHub CLIを使用**
```bash
# GitHub CLIをインストール
# https://cli.github.com/

# ログイン
gh auth login

# その後、通常通りプッシュ
git push -u origin main
```

### エラー3: リモートが既に存在する
```bash
# リモートを確認
git remote -v

# 既存のリモートを削除
git remote remove origin

# 新しいリモートを追加
git remote add origin https://github.com/haru268/-.git
```

## 完全な手順（HTTPS使用）

```bash
# 1. リポジトリの初期化（まだの場合）
git init

# 2. すべてのファイルを追加
git add .

# 3. コミット
git commit -m "最初のコミット"

# 4. ブランチ名をmainに変更
git branch -M main

# 5. リモートを追加（既にある場合は削除してから）
git remote remove origin  # 既にある場合
git remote add origin https://github.com/haru268/-.git

# 6. プッシュ
git push -u origin main
```







