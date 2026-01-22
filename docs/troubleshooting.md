# Troubleshooting

## npm install returns 403

If you see a `403 Forbidden` response while fetching packages (for example, from `registry.npmjs.org`), the environment likely blocks outbound access to the public npm registry or requires proxy/credential configuration.

Example excerpt from an npm debug log in this environment:

```
http fetch GET 403 https://registry.npmjs.org/three
http fetch GET 403 https://registry.npmjs.org/typescript
http fetch GET 403 https://registry.npmjs.org/vite
error 403 403 Forbidden - GET https://registry.npmjs.org/three
error 403 In most cases, you or one of your dependencies are requesting
error 403 a package version that is forbidden by your security policy, or
error 403 on a server you do not have access to.
```
