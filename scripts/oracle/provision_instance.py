#!/usr/bin/env python3
"""Idempotent, one-attempt-per-run OCI instance provisioner.

GitHub Actions schedules this script every 15 minutes. It never loops or
creates a second non-terminated instance with the configured display name.
"""
import os
import sys
import oci
from oci.exceptions import ServiceError

def required(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required GitHub variable/secret: {name}")
    return value

def main():
    user = required("OCI_USER_OCID")
    tenancy = required("OCI_TENANCY_OCID")
    fingerprint = required("OCI_FINGERPRINT")
    private_key = required("OCI_PRIVATE_KEY_PEM").replace("\\n", "\n")
    region = required("OCI_REGION")
    compartment = required("OCI_COMPARTMENT_OCID")
    subnet = required("OCI_SUBNET_OCID")
    image = required("OCI_IMAGE_OCID")
    shape = required("OCI_SHAPE")
    ad = required("OCI_AVAILABILITY_DOMAIN")
    ssh_key = required("OCI_SSH_PUBLIC_KEY")
    display_name = os.getenv("OCI_INSTANCE_NAME", "forge-guard-oracle").strip()
    assign_public_ip = os.getenv("OCI_ASSIGN_PUBLIC_IP", "true").lower() == "true"
    dry_run = os.getenv("PROVISION_DRY_RUN", "false").lower() == "true"

    signer = oci.signer.Signer(
        tenancy=tenancy, user=user, fingerprint=fingerprint,
        private_key_content=private_key,
        pass_phrase=os.getenv("OCI_PRIVATE_KEY_PASSPHRASE") or None,
    )
    config = {"region": region}
    compute = oci.core.ComputeClient(config, signer=signer)

    existing = compute.list_instances(
        compartment_id=compartment,
        display_name=display_name,
        limit=100,
    ).data
    active = [i for i in existing if i.lifecycle_state not in ("TERMINATED", "TERMINATING")]
    if active:
        instance = active[0]
        print(f"ALREADY_EXISTS: {instance.display_name} | {instance.lifecycle_state} | {instance.id}")
        print("No new instance created.")
        return 0

    shape_config = None
    ocpus = os.getenv("OCI_OCPUS", "").strip()
    memory = os.getenv("OCI_MEMORY_GB", "").strip()
    if ocpus or memory:
        if not (ocpus and memory):
            raise RuntimeError("Set both OCI_OCPUS and OCI_MEMORY_GB for flexible shapes.")
        shape_config = oci.core.models.LaunchInstanceShapeConfigDetails(
            ocpus=float(ocpus), memory_in_gbs=float(memory)
        )

    details = oci.core.models.LaunchInstanceDetails(
        availability_domain=ad,
        compartment_id=compartment,
        display_name=display_name,
        shape=shape,
        shape_config=shape_config,
        source_details=oci.core.models.InstanceSourceViaImageDetails(
            image_id=image,
            source_type="image",
        ),
        create_vnic_details=oci.core.models.CreateVnicDetails(
            subnet_id=subnet,
            assign_public_ip=assign_public_ip,
        ),
        metadata={"ssh_authorized_keys": ssh_key},
    )

    if dry_run:
        print("DRY_RUN: credentials validated and no active instance found.")
        print(f"Would request {shape} in {region} / {ad}, subnet {subnet}.")
        return 0

    try:
        response = compute.launch_instance(details)
        instance = response.data
        print(f"CREATE_ACCEPTED: {instance.display_name} | {instance.lifecycle_state} | {instance.id}")
        return 0
    except ServiceError as exc:
        message = f"OCI_ERROR status={exc.status} code={exc.code} message={exc.message}"
        print(message)
        if exc.status == 429 or exc.status >= 500 or "capacity" in (exc.message or "").lower():
            print("RETRY_LATER: next scheduled workflow run will try again.")
            return 0
        # Invalid credentials, image, subnet, permissions, or shape must be fixed;
        # do not disguise configuration failures as capacity retries.
        return 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"CONFIGURATION_OR_RUNTIME_ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
