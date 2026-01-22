# トラブルシューティング

## npm install が 403 を返す

`registry.npmjs.org` などの取得で `403 Forbidden` が出る場合、環境側で公開npmレジストリへのアクセスがブロックされているか、プロキシ/認証の設定が必要な可能性があります。

この環境で確認された npm デバッグログの一例:

```
http fetch GET 403 https://registry.npmjs.org/three
http fetch GET 403 https://registry.npmjs.org/typescript
http fetch GET 403 https://registry.npmjs.org/vite
error 403 403 Forbidden - GET https://registry.npmjs.org/three
error 403 In most cases, you or one of your dependencies are requesting
error 403 a package version that is forbidden by your security policy, or
error 403 on a server you do not have access to.
```
