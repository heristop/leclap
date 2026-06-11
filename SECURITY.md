# Security Policy

## Supported versions

This project is pre-1.0 and under active development. Security fixes are applied to the latest release on the `main` branch only; older versions are not maintained.

| Version         | Supported |
| --------------- | --------- |
| latest (`main`) | yes       |
| older           | no        |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately by opening a security advisory at
<https://github.com/heristop/ffmpeg-video-composer/security/advisories/new>.

Include the affected component, reproduction steps, and impact. We aim to acknowledge a report within a few business days and to keep you updated as we work on a fix. Coordinated disclosure is appreciated.

## Demo server caveat

`packages/server-app` is a **reference / demo implementation** of the library. It ships with no authentication, no rate limiting, and no upload quotas, and it accepts requests from any origin. It is not hardened for production and must not be exposed to untrusted traffic. See its [README](./packages/server-app/README.md) for details.
