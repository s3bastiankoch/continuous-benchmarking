# Required variables
variable "gcp_project" {
  description = "GCP project id"
}

variable "gcp_region" {
  description = "GCP region"
  default     = "europe-west3"
}

variable "gcp_zone" {
  description = "GCP zone"
  default     = "europe-west3-c"
}

# An instace type that allows nested virtualization is required
variable "gcp_instance_type" {
  description = "GCP instance type"
  default     = "n2-standard-4" # 4 vCPUs, 16 GB RAM
  # default = "n2-standard-2" # 2 vCPUs, 8 GB RAM
}

variable "gcp_ssh_private_key" {
  description = "GCP ssh private key"
  sensitive   = true
}

variable "gcp_ssh_public_key" {
  description = "GCP ssh public key"
}
