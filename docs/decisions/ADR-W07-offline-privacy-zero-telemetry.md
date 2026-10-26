# ADR-W07: Fully Offline, Privacy Baseline, and Zero Telemetry

Status: Accepted  
Decided: Setup / M1 Scaffold (Features 6)

## Context
Many modern desktop apps include background telemetry, error reporting SDKs (Sentry, Bugsnag), auto-updaters, analytics, or cloud accounts that compromise user privacy and leak private note contents or metadata.

## Decision
1. **Zero Network Calls**: Wrriter never initiates outbound network requests on its own.
2. **Single Allowed Exception**: The image downloader invoked only when the user explicitly drags and drops an image from an external browser into the note.
3. **No Auto-Updaters**: No update checking, auto-downloaders, or background polling. Updates are strictly manual downloads.
4. **No Analytics or Telemetry**: Zero analytics SDKs, zero crash-reporting services, zero AI APIs.
5. **Private Logs**: Logs record operational errors only in the local app data folder and never contain note content, paths of encrypted notes, or personal identifying data.

## Consequences
- Guaranteed privacy and offline operability for sensitive note collections.
- Zero network battery drain and zero background telemetry overhead.
- Simple, reliable, auditable open-source security posture.
