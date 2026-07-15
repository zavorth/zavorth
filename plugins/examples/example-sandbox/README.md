# example-sandbox

Minimal Plugin OS **sandbox** example. Binds `sandbox.run` as a local stub (no process spawn).

```bash
zavorth plugins install ./plugins/examples/example-sandbox --yes
zavorth plugins enable example-sandbox --yes
zavorth plugins test ./plugins/examples/example-sandbox
```
