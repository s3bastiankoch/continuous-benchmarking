terraform {
  required_version = "~> 1.0"

  required_providers {
    google = {
      source = "hashicorp/google"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "5.21.0"
    }
  }
}

provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project
  region  = var.gcp_region
}

# Create VPC network
resource "google_compute_network" "empiris-duet-network" {
  name = "empiris-duet-network"
}


# Create static IP
resource "google_compute_address" "empiris-duet-ip" {
  name = "empiris-duet-ip"
}

# Setup compute instance in GCP
# resource "google_compute_instance" "empiris-duet-instance" {
#   name         = "empiris-duet-instance"
#   machine_type = var.gcp_instance_type
#   zone         = var.gcp_zone

#   # Enable nested virtualization
#   advanced_machine_features {
#     enable_nested_virtualization = true
#     threads_per_core             = 1
#   }

#   # Tag the instance so we can apply firewall rules to it
#   tags = ["empiris-instance"]

#   boot_disk {
#     initialize_params {
#       # Debian Bullseye
#       image = "debian-cloud/debian-11"
#       size  = 100
#     }
#   }

#   network_interface {
#     network = google_compute_network.empiris-duet-network.name
#     access_config {
#       # Allow access to http and https
#       nat_ip = google_compute_address.empiris-duet-ip.address
#     }
#   }

#   #metadata_startup_script = file("deps.sh")
# }

resource "google_compute_instance_from_machine_image" "empiris-duet-instance" {
  provider     = google-beta
  name         = "empiris-duet-instance"
  zone         = var.gcp_zone
  machine_type = var.gcp_instance_type

  advanced_machine_features {
    threads_per_core = 1
  }

  source_machine_image = "projects/empiris/global/machineImages/firecracker-duet-benchmarking"

  network_interface {
    network = google_compute_network.empiris-duet-network.name
    access_config {
      nat_ip = google_compute_address.empiris-duet-ip.address
    }
  }

  // SSH public key
  metadata = {
    ssh-keys = "empiris:${var.gcp_ssh_public_key}"
  }

  metadata_startup_script = file("setup.sh")

  provisioner "file" {
    source      = "../../request-queue"
    destination = "/home/empiris/request-queue"
    connection {
      type        = "ssh"
      user        = "empiris"
      private_key = var.gcp_ssh_private_key
      host        = google_compute_address.empiris-duet-ip.address
    }
  }

  # Create a directory for the serverless-ts project
  provisioner "remote-exec" {
    inline = [
      "mkdir -p /home/empiris/serverless-ts"
    ]

    connection {
      type        = "ssh"
      user        = "empiris"
      private_key = var.gcp_ssh_private_key
      host        = google_compute_address.empiris-duet-ip.address
    }
  }

  provisioner "file" {
    source      = "../../examples/sieve-of-eratosthenes-web-server/src"
    destination = "/home/empiris/serverless-ts/src"

    connection {
      type        = "ssh"
      user        = "empiris"
      private_key = var.gcp_ssh_private_key
      host        = google_compute_address.empiris-duet-ip.address
    }
  }

  provisioner "file" {
    source      = "../../examples/sieve-of-eratosthenes-web-server/package.json"
    destination = "/home/empiris/serverless-ts/package.json"
    connection {
      type        = "ssh"
      user        = "empiris"
      private_key = var.gcp_ssh_private_key
      host        = google_compute_address.empiris-duet-ip.address
    }
  }

  provisioner "file" {
    source      = "../../examples/sieve-of-eratosthenes-web-server/Dockerfile"
    destination = "/home/empiris/serverless-ts/Dockerfile"
    connection {
      type        = "ssh"
      user        = "empiris"
      private_key = var.gcp_ssh_private_key
      host        = google_compute_address.empiris-duet-ip.address
    }
  }
}

# Setup firewall rule to allow access to port for postgres
resource "google_compute_firewall" "empiris-duet-firewall" {
  name    = "empiris-duet-firewall"
  network = google_compute_network.empiris-duet-network.name

  allow {
    protocol = "tcp"
    ports    = ["80", "22"]
  }


  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["empiris-instance"]
}


# Output the IP address
output "ip" {
  value = google_compute_address.empiris-duet-ip.address
}
