# create-zavorth

Safe dry-run bootstrap package for new Zavorth projects.

```bash
npm create zavorth@latest -- --help
npm create zavorth@latest -- --dry-run my-zavorth-app
```

This package is intentionally conservative in the alpha publish path:

- no secrets are written
- no runtime is started
- no provider, tool, command, or transport is executed
- no package is published by the initializer

After a future write-enabled scaffold gate creates a project, the local project
flow remains:

```bash
npm install
npm run setup
npm run go
npm run doctor
```

New users on the public package should prefer `npm create zavorth@latest`. The
package also supports direct `create-zavorth --help` and
`create-zavorth --dry-run` checks.
