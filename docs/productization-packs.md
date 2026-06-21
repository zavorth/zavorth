# Productization Packs

The productization packs expose existing Zavorth systems to the Action Harness and Echo LLM tool surface. Mutating actions still require preview, approval and receipts.

## Plugin SDK

Use `zavorth plugins scaffold` or `zavorth plugins create` to create a local extension, then inspect it with `zavorth actions preview plugins.sdk.lifecycle`. Lifecycle changes are approval-gated.

## Long-tail channels

The supported long-tail channels are Matrix, Nostr, IRC, Twitch, WeChat, DingTalk, Feishu and Line. Configure one webhook per channel with either convention:

```text
ZAVORTH_MATRIX_WEBHOOK_URL=https://...
MATRIX_WEBHOOK_URL=https://...
```

Ask Zavorth to prepare a draft first. Delivery always routes through `channels.send_approved`, which requires approval and emits a receipt. Do not put webhook URLs in prompts or committed files.

## Voice backends

`voice.synthesize_live` writes a governed audio artifact after approval.

- Edge TTS uses the bundled `msedge-tts` dependency and defaults to `pt-BR-FranciscaNeural`.
- ElevenLabs needs `ELEVENLABS_API_KEY` and optionally `ELEVENLABS_TTS_URL`, `ELEVENLABS_VOICE_ID` and `ELEVENLABS_TTS_MODEL`.
- MiniMax needs `MINIMAX_API_KEY` and `MINIMAX_TTS_URL` (or `ZAVORTH_MINIMAX_TTS_URL`).
- NeuTTS needs `ZAVORTH_NEUTTS_ENDPOINT` and optionally `ZAVORTH_NEUTTS_API_KEY`.
- Gemini uses the existing `GEMINI_API_KEY` voice service.

Artifacts are created under `.zavorth/artifacts/voice/` in the active workspace.

## Terminal backends

Singularity/Apptainer is a first-class terminal backend. Set `ZAVORTH_SINGULARITY_ENABLED=true` and `ZAVORTH_SINGULARITY_IMAGE=<trusted-image>`, then inspect the plan before asking for a live command. Live execution also requires the global terminal live gate and scoped approval.

## NixOS and Termux

The Nix flake exports `nixosModules.zavorth`; import it in a NixOS configuration, set `services.zavorth.enable = true`, and supply the package/environment appropriate for the deployment. For Termux, run `deploy/termux/install.sh` from a trusted checkout. PRoot is compatibility tooling, not a hardened isolation boundary.
