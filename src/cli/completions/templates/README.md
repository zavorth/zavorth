Zavorth completion templates are generated from `ZavorthCompletionsCommand.ts`.

The command intentionally keeps installation opt-in:

```bash
zavorth completions bash
zavorth completions zsh
zavorth completions fish
zavorth completions powershell
zavorth completions powershell --install
```

Installers may print the setup command, but should not mutate shell profiles
without explicit operator consent.
