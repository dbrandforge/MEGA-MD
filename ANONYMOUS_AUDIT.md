# Anonymous Night forensic audit

## What is recorded

For each accepted form submission, the server writes a record to the dedicated MongoDB collection `anonymous_submission_audit` **before** rendering or posting the image. The record contains:

- Unique submission ID, group JID, submission timestamp and delivery status.
- WhatsApp message ID returned by Baileys after a successful send, plus delivery timestamp.
- Browser name/version, operating system/version, device class and model only when exposed by the browser.
- Client Hints (when supplied) and accepted language.
- Public IP address and full user-agent string, encrypted with AES-256-GCM.
- Keyed IP HMAC for correlation without decrypting the IP.
- HMAC of the submitted text for integrity/correlation; the raw text is not duplicated in the audit collection.

No WhatsApp phone number is available from this browser form. Browser/device metadata can be incomplete or deliberately altered, and IP addresses may represent shared networks, VPNs or carrier gateways. These records are investigative leads, not proof of a person's identity.

## Required Render environment

Set `ANON_AUDIT_ENCRYPTION_KEY` to a newly generated, secret 32-byte key encoded as 64 hexadecimal characters or Base64. Generate it securely outside the repository, store it only as a Render secret, and keep a separate encrypted offline recovery copy. **Do not commit the key or send it in chat.** Losing the key makes encrypted IP addresses and user-agent strings permanently unreadable.

The service also requires the existing `MONGO_URL`. The application writes to a separate collection and uses majority write acknowledgement. If MongoDB or the encryption key is unavailable, the submission endpoint fails closed and does not post an untracked anonymous message.

## Retention, backups and access

- Records expire automatically after 365 days using a MongoDB TTL index.
- IP and raw user-agent values are application-encrypted. MongoDB's own encryption-at-rest and network TLS should also remain enabled.
- There is no public endpoint to retrieve these records. The `.anontrace` command is strict-creator-only; whether invoked in a group or DM, the report is sent only to the creator's DM. Every lookup attempt is recorded in a separate access collection using keyed hashes of the actor and lookup reference, with 365-day TTL; raw creator numbers are not duplicated in that access log.
- A separate private Cloudflare R2 bucket (`forge-guard-forensics`, Western Europe) receives incremental archives. The Worker exposes a write-only, Ed25519-authenticated endpoint; there is no public archive-read route.
- The app reads at most 50 records per backup pass, processes only records after the last successful cursor, gzip-compresses and AES-256-GCM encrypts each batch, and uploads one batch every 10 minutes. It advances the MongoDB checkpoint only after R2 confirms the object write. It never loads the full audit collection into RAM.
- R2 archive objects expire after 365 days. The batch archive is encrypted independently of the per-field encryption; both use the audit encryption key. Each batch is signed with Ed25519. The private PKCS#8 key stays in Render; only its public SPKI key is embedded in the Worker. The Worker does not need a shared secret.
- Required Render settings once the Worker public key is deployed: `ANON_AUDIT_BACKUP_ENABLED=true`, `ANON_AUDIT_BACKUP_URL=https://forge-guard-edge.brandforge-ent.workers.dev/forensic-backup`, `ANON_AUDIT_BACKUP_SIGNING_KEY` (base64 PKCS#8 Ed25519 private key), and optional `ANON_AUDIT_BACKUP_BATCH_SIZE=50`.
- Majority write acknowledgement is **not** a backup. Keep MongoDB Atlas backup/snapshot or point-in-time recovery enabled as an additional recovery layer.
- Restrict MongoDB credentials, audit administrative access, and do not export or share records casually. Retention should be reviewed against the service's privacy notice and applicable law.

## Proxy and metadata limitations

Express trusts one Render proxy hop to obtain the client IP. The app does not accept arbitrary forwarded-IP values as authoritative beyond that configured hop. Browser model details are collected only from normal User-Agent or Client Hints headers; there is no canvas, font, audio, location, or other covert browser fingerprinting.


## Batched archive implementation

The backup cursor lives in the MongoDB collection `anonymous_submission_audit_backup_state`. Each successful upload records the last archived MongoDB _id, object key, time, and batch count. A failed upload does not advance the cursor, so the same records are retried on the next pass. The default batch size is 50 (hard maximum 100), with a 10-minute interval and one in-flight batch per process. Each archive uses the binary format `FGA1` (magic bytes, 12-byte IV, 16-byte GCM tag, ciphertext). The ciphertext contains gzip-compressed newline-delimited JSON.

The backup scheduler remains disabled unless `ANON_AUDIT_BACKUP_ENABLED=true`. Do not enable it until the Worker public key and matching Render private-key environment variable have both been configured. The audit collection itself is still the primary live store; R2 is the independent archive.
