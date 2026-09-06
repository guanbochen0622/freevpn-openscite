# FreeVPN + NUU Academic Mode

Self-hosted WireGuard VPN manager with an optional National United University (NUU) academic-access launcher.

## What NUU Academic Mode does

- Opens the official NUU SSL VPN / Check Point login page.
- Credentials are entered only on the official `nuu.edu.tw` service. FreeVPN does not proxy, receive, or store NUU credentials.
- After successful official VPN authentication, eligible NUU users can obtain a campus IP for services that permit VPN access.
- The dashboard also links to the official NUU VPN instructions and National United University Library.

The NUU mode is intentionally **not** implemented by spoofing an NUU IP or relaying school credentials through this project.

## Quick start

1. Use a Linux VPS with a public IPv4 address.
2. Install Docker + Docker Compose.
3. Copy `.env.example` to `.env` and set `VPN_ENDPOINT` and a long random `ADMIN_TOKEN` (16+ characters). For production, keep `COOKIE_SECURE=true` and put the dashboard behind HTTPS. For a short HTTP-only first-run test, set `COOKIE_SECURE=false`.
4. Run:

```bash
docker compose up -d --build
```

5. If you temporarily set `COOKIE_SECURE=false`, open `http://SERVER_IP:8080/`. For normal use, expose the dashboard only through HTTPS and keep `COOKIE_SECURE=true`.
6. Create a device, then scan the QR code with the WireGuard mobile app or download the `.conf` file.

Open UDP 51820 and TCP 8080 in your cloud firewall/security group.

For production, put the web UI behind HTTPS and restrict TCP 8080 to your own IP/VPN.

## NUU usage

For normal Internet traffic, use your private WireGuard profile. For NUU resources, press **NUU Academic Mode** and authenticate using the official university VPN. Some operating systems do not allow two full-tunnel VPNs simultaneously; if Check Point conflicts with WireGuard, disconnect WireGuard first and then connect NUU VPN.


## Security notes

- The admin password is never stored directly in the browser cookie; the dashboard uses an HMAC-derived session cookie.
- State-changing forms use CSRF protection.
- Startup refuses placeholder/short admin secrets and an unset VPN endpoint.
- Client configuration and QR responses send `Cache-Control: no-store`.
- Client private keys are stored in `/data/clients` so profiles can be re-downloaded. Protect the host and back up this directory securely; a host compromise exposes those client keys.
- The NUU button only opens the official university SSL VPN endpoint; NUU credentials are not proxied through this app.


## Integrated OpenScite flow

This build bundles OpenScite Web v10 under `/openscite` and exposes the browser-automation extension at `/automation-extension`.

Flow:

`FreeVPN → General VPN / NUU Academic Mode`

Academic Mode:

`Official NUU VPN → user authenticates directly with NUU → user confirms connection → OpenScite → DOI / PMID / title → OA first → institutional publisher access → explicit PDF download confirmation`.

### Important implementation detail

A normal web dashboard cannot reliably inspect the operating system's VPN tunnel state. Therefore this build does **not** fake an automatic "NUU Connected" result. It opens the official NUU VPN, explains the trust boundary, and requires the user to confirm that the official connection has completed. Actual subscription access is then determined by NUU/publisher servers.

The integrated OpenScite v10 extension can use temporary publisher permissions and single-tab network inspection to locate PDF responses already available to the user's authorized browser session. It does not collect NUU credentials or bypass access controls.
