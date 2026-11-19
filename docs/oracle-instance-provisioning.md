# Oracle instance provisioning automation

This workflow attempts **one** OCI instance creation per scheduled run (every 15 minutes). It is intentionally separate from the live Render service. It does not alter VCNs, gateways, route tables, security lists, NSGs, or existing instances.

## Before enabling

Populate the GitHub repository Settings → Secrets and variables → Actions.

### Repository secrets

- `OCI_USER_OCID`: OCI API user's OCID
- `OCI_TENANCY_OCID`: tenancy OCID
- `OCI_FINGERPRINT`: API signing-key fingerprint
- `OCI_PRIVATE_KEY_PEM`: full PEM private key contents (never commit this)
- `OCI_PRIVATE_KEY_PASSPHRASE`: only if the private key is encrypted
- `OCI_SSH_PUBLIC_KEY`: public SSH key text for instance access

### Repository variables

- `OCI_REGION`: region identifier, e.g. the region selected in the OCI console
- `OCI_COMPARTMENT_OCID`: target compartment OCID
- `OCI_SUBNET_OCID`: **existing subnet OCID from the already-configured Forge Guard VCN**
- `OCI_IMAGE_OCID`: image OCID available in that region (Oracle Linux is the initial preferred image; verify compatibility/availability)
- `OCI_SHAPE`: exact OCI shape name
- `OCI_AVAILABILITY_DOMAIN`: exact availability-domain name
- `OCI_INSTANCE_NAME`: default `forge-guard-oracle`
- `OCI_ASSIGN_PUBLIC_IP`: `true` only if the selected existing subnet is public and the design requires a public IP; otherwise `false`
- `OCI_OCPUS` and `OCI_MEMORY_GB`: set both for flexible shapes; leave both blank for fixed shapes

Do not guess or recreate network IDs. Use the subnet already created in the Forge Guard VCN. Confirm its route table, internet/NAT path, security rules/NSGs, and whether it is public or private before choosing the public-IP setting. A private subnet normally needs a deliberate egress design; do not assign a public IP to bypass that design.

## Safe activation sequence

1. Add the OCI API signing key to the OCI user and note its fingerprint. Store the private key only as a GitHub secret.
2. Copy the exact existing VCN subnet OCID and the correct compartment/region values into repository variables.
3. Select the image, shape, and availability domain from the same region.
4. Run Actions → Oracle Instance Provisioner → Run workflow with `dry_run=true`.
5. Review the run logs. Only after the dry run passes, run manually with `dry_run=false`; the scheduled runs will then continue automatically.
6. Monitor Actions → Oracle Instance Provisioner. Capacity/rate-limit/server-side errors are logged as retry-later and the next scheduled run makes another single attempt.

## Safety behaviour

- A repository-level Actions concurrency lock prevents overlapping runs.
- Before launch, the script checks for a non-terminated instance with the configured display name in the target compartment.
- Existing active/provisioning/stopped instances prevent duplicate creation.
- Capacity, throttling, and transient server errors wait for the next scheduled run.
- Authentication, permissions, invalid OCIDs, unsupported shapes/images, and other configuration errors fail visibly and require correction.
- The workflow does not delete, stop, resize, or modify any instance or networking resource.

## Monitoring

Open the repository's Actions tab → Oracle Instance Provisioner. Each run prints one of:
- `DRY_RUN`: configuration validated; no instance requested
- `RETRY_LATER`: transient capacity/service condition; scheduled retry remains active
- `CREATE_ACCEPTED`: OCI accepted the create request; use the instance OCID in OCI Console to watch provisioning
- `ALREADY_EXISTS`: an instance with this name already exists; no duplicate was requested
- `CONFIGURATION_OR_RUNTIME_ERROR`: fix the reported issue before relying on retries

GitHub scheduled workflows are best-effort, not exact timers. A disabled/inactive repository workflow or GitHub Actions quota/availability can delay scheduled attempts.
