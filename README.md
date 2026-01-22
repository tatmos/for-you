# Meaning-space Surfing（Webプロトタイプ）

Three.js + Viteの最小構成で、意味空間を漂うように探索するプロトタイプです。ノードは概念、エッジは関連度、フロー場がドリフト移動を緩やかに誘導します。

## 特徴
- 決定論的なグラフ生成（約300ノード + 重み付きエッジ）
- 星雲のような点群と、控えめなエッジ表示
- ホバーで近傍をハイライトし、ラベルを表示
- ドリフトモード（スペースキー）でフロー場に沿って移動

## ローカル実行

```bash
npm install
npm run dev
```

起動後、表示されたViteのローカルURLをブラウザで開いてください。

## 操作
- ドラッグ: オービット
- スクロール: ズーム
- Space: ドリフト切り替え

## デプロイ（GitHub Pages）

このリポジトリには `.github/workflows/deploy.yml` のGitHub Actionsワークフローが含まれており、`main` ブランチへのpush時にViteアプリをビルドして `dist/` をGitHub Pagesへ公開します。
