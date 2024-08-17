#!/bin/bash

set -o allexport
source ../../.env set
set +o allexport

export TF_VAR_gcp_ssh_private_key=$CLOUD_SSH_PRIVATE_KEY
export TF_VAR_gcp_ssh_public_key=$CLOUD_SSH_PUBLIC_KEY

terraform destroy