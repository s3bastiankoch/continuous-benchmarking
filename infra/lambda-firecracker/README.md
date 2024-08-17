# Lambda Emulation with Firecracker on GCP

This sets up an AWS lambda emulation inside a GCP compute instance using Firecracker microVMs and containerd.
The lambda functions must therefore be dockerized. The Dockerfile is copied to the VM, saved to a tarball and then imported into firecracker-containerd.

## Get Started

```sh
terraform init
```

```sh
terraform apply
```

```sh
./copy.sh
```

SSH into the instance and run:

```sh
./firecracker-containerd.sh
```

Then start the lambdas and the request queue

## Network
