#!/usr/bin/env python3
"""Discover and provision an Always Free-compatible OCI instance.

Discovers Ubuntu 24.04 images and configured Always Free shapes in the target
region/AD, then tries compatible combinations. Dry-run is read-only.
"""
import os
import sys
import time
import oci
from oci.exceptions import ServiceError

TERMINAL_STATES = {"TERMINATED", "TERMINATING"}
FREE_TIER_SHAPES = ("VM.Standard.A1.Flex", "VM.Standard.E2.1.Micro")


def env(name, default=""):
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def required(name):
    value = env(name)
    if not value:
        raise RuntimeError(f"Missing required GitHub variable/secret: {name}")
    return value


def bool_env(name, default=False):
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def resolve_availability_domain(identity, compartment, configured):
    domains = identity.list_availability_domains(compartment_id=compartment).data
    for domain in domains:
        if configured in {domain.name, domain.name.split(":")[-1], domain.display_name}:
            print(f"AVAILABILITY_DOMAIN_RESOLVED: {domain.display_name}")
            return domain.name
    raise RuntimeError(
        f"Configured availability domain {configured!r} was not found. "
        "Set OCI_AVAILABILITY_DOMAIN to AD-1 or the exact OCI AD name."
    )


def classify_arch(shape_name):
    name = shape_name.lower()
    if ".a1." in name or "ampere" in name:
        return "arm64"
    if ".e2." in name or "amd" in name or "intel" in name:
        return "x86_64"
    return None


def image_arch(image):
    name = (getattr(image, "display_name", "") or "").lower()
    if any(value in name for value in ("aarch64", "arm64", "arm-64")):
        return "arm64"
    if any(value in name for value in ("x86_64", "amd64", "x64")):
        return "x86_64"
    return None


def is_capacity_error(exc):
    code = (getattr(exc, "code", "") or "").lower()
    message = (getattr(exc, "message", "") or "").lower()
    return (
        code in {"outofhostcapacity", "capacityconstraint", "internalerror"}
        or "capacity" in message
        or getattr(exc, "status", 0) in {429, 500, 503}
    )


def discover_candidates(compute, compartment, ad):
    allowed = tuple(
        item.strip()
        for item in env("OCI_ALLOWED_SHAPES", ",".join(FREE_TIER_SHAPES)).split(",")
        if item.strip()
    )
    disallowed = set(allowed) - set(FREE_TIER_SHAPES)
    if disallowed:
        raise RuntimeError(
            "Paid/unknown shapes blocked by Always Free safety policy: "
            + ", ".join(sorted(disallowed))
        )

    shapes = compute.list_shapes(
        compartment_id=compartment, availability_domain=ad, limit=100
    ).data
    available = {shape.shape for shape in shapes}
    shape_names = [name for name in allowed if name in available]
    if not shape_names:
        raise RuntimeError(
            "No configured Always Free shape is currently listed in this AD. "
            f"Checked: {', '.join(allowed)}"
        )

    images = compute.list_images(
        compartment_id=compartment,
        operating_system="Canonical Ubuntu",
        operating_system_version="24.04",
        sort_by="TIMECREATED",
        sort_order="DESC",
        limit=50,
    ).data
    candidates = []
    for shape_name in shape_names:
        arch = classify_arch(shape_name)
        if not arch:
            continue
        for image in images:
            if image_arch(image) != arch:
                continue
            compatible = getattr(image, "compatible_shapes", None) or []
            if compatible and shape_name not in compatible:
                continue
            candidates.append((shape_name, image, arch))
    return candidates


def launch_config(shape_name):
    if shape_name == "VM.Standard.A1.Flex":
        # Tenancy-wide Always Free A1 ceiling: 4 OCPUs / 24 GB RAM.
        ocpus = float(env("OCI_A1_OCPUS", "4"))
        memory = float(env("OCI_A1_MEMORY_GB", "24"))
        if not (0 < ocpus <= 4 and 1 <= memory <= 24):
            raise RuntimeError("A1 settings exceed the Always Free ceiling (4 OCPU / 24 GB).")
        return oci.core.models.LaunchInstanceShapeConfigDetails(
            ocpus=ocpus, memory_in_gbs=memory
        )
    return None


def main():
    user = required("OCI_USER_OCID")
    tenancy = required("OCI_TENANCY_OCID")
    fingerprint = required("OCI_FINGERPRINT")
    private_key = required("OCI_PRIVATE_KEY_PEM").replace("\\n", "\n")
    region = required("OCI_REGION")
    config = {
        "tenancy": tenancy,
        "user": user,
        "fingerprint": fingerprint,
        "key_content": private_key,
        "pass_phrase": env("OCI_PRIVATE_KEY_PASSPHRASE") or None,
        "region": region,
    }

    identity = oci.identity.IdentityClient(config)
    identity.get_user(user)
    print(f"OCI_AUTHENTICATION_OK: authenticated in {region}")

    compartment = required("OCI_COMPARTMENT_OCID")
    subnet = required("OCI_SUBNET_OCID")
    configured_ad = required("OCI_AVAILABILITY_DOMAIN")
    ad = resolve_availability_domain(identity, compartment, configured_ad)
    compute = oci.core.ComputeClient(config)

    display_name = env("OCI_INSTANCE_NAME", "forge-guard-oracle")
    existing = compute.list_instances(
        compartment_id=compartment, display_name=display_name, limit=100
    ).data
    active = [item for item in existing if item.lifecycle_state not in TERMINAL_STATES]
    if active:
        item = active[0]
        print(f"ALREADY_EXISTS: {item.display_name} | {item.lifecycle_state} | {item.id}")
        return 0

    candidates = discover_candidates(compute, compartment, ad)
    if not candidates:
        raise RuntimeError("No compatible Ubuntu 24.04 image and Always Free shape combinations found.")

    print(f"DISCOVERY_OK: {len(candidates)} compatible candidate(s) in {configured_ad}")
    for index, (shape_name, image, arch) in enumerate(candidates, 1):
        print(f"CANDIDATE_{index}: shape={shape_name} arch={arch} image={image.display_name} image_ocid={image.id}")

    if bool_env("PROVISION_DRY_RUN", True):
        print("DRY_RUN: discovery complete; no OCI resources changed.")
        return 0

    ssh_key = required("OCI_SSH_PUBLIC_KEY")
    assign_public_ip = bool_env("OCI_ASSIGN_PUBLIC_IP", True)
    failures = 0
    for index, (shape_name, image, arch) in enumerate(candidates, 1):
        details = oci.core.models.LaunchInstanceDetails(
            availability_domain=ad,
            compartment_id=compartment,
            display_name=display_name,
            shape=shape_name,
            shape_config=launch_config(shape_name),
            source_details=oci.core.models.InstanceSourceViaImageDetails(
                image_id=image.id, source_type="image"
            ),
            create_vnic_details=oci.core.models.CreateVnicDetails(
                subnet_id=subnet, assign_public_ip=assign_public_ip
            ),
            metadata={"ssh_authorized_keys": ssh_key},
        )
        try:
            instance = compute.launch_instance(details).data
            print(
                f"CREATE_ACCEPTED: candidate={index} shape={shape_name} "
                f"image={image.id} state={instance.lifecycle_state} instance={instance.id}"
            )
            return 0
        except ServiceError as exc:
            print(
                f"CANDIDATE_FAILED: candidate={index} shape={shape_name} "
                f"image={image.id} status={exc.status} code={exc.code} message={exc.message}"
            )
            failures += 1
            if not is_capacity_error(exc):
                print("STOPPING: error is not classified as transient capacity/throttling.")
                return 2
            time.sleep(min(2 * failures, 10))

    print(f"NO_CAPACITY: all {failures} candidate launch attempts failed; scheduled run will retry.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"CONFIGURATION_OR_RUNTIME_ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
