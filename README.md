# Meaning-space Surfing（Webプロトタイプ）

Three.js + Viteで、高次元意味空間を漂うように探索するインタラクティブな可視化プロトタイプです。ノードは概念、エッジは関連度、フロー場がドリフト移動を緩やかに誘導します。

## 特徴

### コアビジュアライゼーション
- 決定論的なグラフ生成（約300ノード + 重み付きエッジ）
- カスタムシェーダーによる美しい点群レンダリング
  - 距離ベースのフェード
  - 微細な時間ベースの輝度変化（トゥインクル）
- ホバーで近傍をハイライトし、ラベルを表示
- ドリフトモード（スペースキー）でフロー場に沿って移動

### スカラーフィールドシステム
- **Coherence（コヒーレンス）**: ノード間の方向の一貫性を表す
- **Entropy（エントロピー）**: 無秩序さを表す（1 - coherence）
- **FlowStrength（フロー強度）**: 局所的なベクトル場の強さ

### 適応的ビジュアルフィードバック
- **ストリームライン可視化**: ベクトル場統合による流線表示
  - コヒーレントな領域では長く明るい流線（非線形強調）
  - 拡散領域では短く淡い流線
  - flowStrengthとcoherenceを組み合わせた長さ決定
  - **Hero Streamlines**: ドリフト時、カメラ前方に「道」を示す主流線（5本）
- **3層深度レンダリング**: 星雲のような奥行き表現
  - Near層: シャープで明瞭
  - Mid層: ソフトでなめらか
  - Far層: 霧に溶け込む（霧色とブレンド）
- **ダイナミックブルームエフェクト**: Unreal Bloom Pass
  - 非線形カーブ（smoothstep、二乗）で自然な変化
  - 白飛び防止設計（threshold 0.74-0.92）
  - 高コヒーレンス時も「気配」として機能
- **適応的フォグ**: コヒーレンスに応じて視界距離が変化
- **エッジ透明度**: 非線形（二乗）コヒーレンスで動的調整

## ローカル実行

```bash
npm install
npm run dev
```

起動後、表示されたViteのローカルURLをブラウザで開いてください。

## 操作
- **ドラッグ**: オービット（Defaultモード）
- **スクロール**: ズーム
- **Space**: ドリフト切り替え
- **I**: Internalizedモード切り替え
- **M**: メトリクス表示/非表示（開発用）
- **ホバー**: ノードと近傍をハイライト（Defaultモード）

## 可視化モード

### Defaultモード
客観的な意味空間マップとして機能。全体構造を把握し、OrbitControlsで自由に探索できます。

### Internalizedモード（瞑想装置）
「空間の中にいる」主観体験。説明的UIを削ぎ落とし、意識点として場を漂います。

**特徴**:
- OrbitControlsを無効化、ドリフトが主要な移動手段
- Hero Streamlines（前方の道）が常に可視化され、直観的方向を示す
- 通常streamlinesとedgesを抑制、局所的知覚を強調
- カメラ周囲の「局所性半径」内で点がより明瞭に
- 滑らかなパラメータ変化（強いスムージング）
- コヒーレンスが点の「twinkle規則性」を制御（coherent時は穏やかに）
- bloomを控えめに、「presence（気配）」として機能

**体験**:
- Iキーを押す → UIが消え、画面中央に微かな「◉」グリフ
- ドリフトが自動でON、前方に道が現れる
- 周囲の空間が「感じられる層」として知覚される
- coherent領域では視界がクリアに、path bundleが安定
- diffuse領域では霞み、pathが短く拡散

## 体験のポイント
- ドリフトをONにすると：
  - 前方に「道」（Hero Streamlines）が現れ、進むべき方向を示します
  - コヒーレント領域で視界が「クリアアップ」し、流線が束になります
  - 空間が「澄む」感覚を、bloom/fog/edges/streamlinesの総合で表現
- 拡散領域では：
  - フォグが濃く、エッジが薄暗く、ブルームが抑えられます
  - 流線は短く淡くなり、空間が「霞む」
- ズームアウトすると：
  - 点群が「霧に溶ける」星雲のような3層表現
  - 奥行きが情報の層として視覚化されます
- カメラ位置のスカラーフィールド値に応じて、シーン全体の雰囲気が有機的に変化します

## パフォーマンス最適化
- **Streamline色更新**: 60fps → 10fpsに間引き（6倍軽量化）
- **Baked Fields**: セグメント毎のスカラーフィールドを事前計算
- **条件付き更新**: Hero Streamlinesはカメラ移動時のみ再生成
- 結果: 約300ノード + 200ストリームライン + 5 Hero Streamlinesで滑らかな動作

## アーキテクチャ
- **ParamBus** (`src/metrics/paramBus.ts`): 全ビジュアルパラメータと状態の中央管理
  - 可視化モード（Default / Internalized）の管理
  - Internalized時のパラメータスムージング
  - 将来の音響統合の接続ポイント
  - coherence, entropy, flowStrength, alignment, driftEnabledを一元提供
  - postprocess / fog / edges / streamlines が統一インターフェースで参照
- **Mode-Aware Rendering**: 各レンダリングシステムがmodeを受け取り、振る舞いを変更
  - `streamlines.ts`: Internalized時は通常streamlines抑制、hero常時表示
  - `postprocess.ts`: Internalized時はbloom控えめ、局所性重視
  - `pointShader.ts`: 局所性半径、coherenceベースのtwinkle制御
  - `lod.ts`: Internalized時はedges/labels完全非表示

## デプロイ（GitHub Pages）

このリポジトリには `.github/workflows/deploy.yml` のGitHub Actionsワークフローが含まれており、`main` ブランチへのpush時にViteアプリをビルドして `dist/` をGitHub Pagesへ公開します。

GitHub Pagesのサブパス（`/<リポジトリ名>/`）で404にならないように、ワークフロー側で `BASE_PATH` を自動設定しています。

`<owner>.github.io` のユーザ/組織ページとして公開する場合はルート配信になるため、`BASE_PATH` は `/` になります。
