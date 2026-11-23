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
- There is no public endpoint or group command to retrieve these records. Access should be limited to the database owner/operator for a documented, serious incident.
- Majority write acknowledgement is **not** a backup. Confirm that the MongoDB Atlas cluster has a supported backup/snapshot or point-in-time recovery plan enabled. If the current cluster tier does not support that, configure a scheduled encrypted export to a separate private backup destination before relying on this as a forensic archive.
- Restrict MongoDB credentials, audit administrative access, and do not export or share records casually. Retention should be reviewed against the service's privacy notice and applicable law.

## Proxy and metadata limitations

Express trusts one Render proxy hop to obtain the client IP. The app does not accept arbitrary forwarded-IP values as authoritative beyond that configured hop. Browser model details are collected only from normal User-Agent or Client Hints headers; there is no canvas, font, audio, location, or other covert browser fingerprinting.
