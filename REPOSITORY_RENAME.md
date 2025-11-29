# GitHubリポジトリ名の変更手順

現在のリポジトリ名「-」を「repologo-race-manager」に変更する手順です。

## リポジトリ名の変更方法

1. GitHubのリポジトリページ（https://github.com/haru268/-）にアクセス
2. リポジトリページの右上にある「Settings」（設定）をクリック
3. 設定ページの一番上にある「Repository name」セクションを探す
4. 現在の名前「-」を「repologo-race-manager」に変更
5. 「Rename」ボタンをクリック
6. 確認ダイアログで「I understand, rename my repository」をクリック

## リモートURLの更新（ローカルリポジトリ）

リポジトリ名を変更した後、ローカルのリモートURLも更新する必要があります：

```bash
# 現在のリモートURLを確認
git remote -v

# リモートURLを更新
git remote set-url origin https://github.com/haru268/repologo-race-manager.git

# 確認
git remote -v
```

## 注意事項

- リポジトリ名を変更すると、既存のクローンURLやリンクが無効になります
- リポジトリ名の変更後、GitHubが自動的にリダイレクトを設定しますが、新しいURLを使用することを推奨します
- リポジトリ名は英数字、ハイフン、アンダースコアのみ使用可能です

