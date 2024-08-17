#!/bin/bash

cd ~

# Install git, Go 1.17, make, curl
sudo mkdir -p /etc/apt/sources.list.d
echo "deb http://ftp.debian.org/debian bullseye-backports main" | \
  sudo tee /etc/apt/sources.list.d/bullseye-backports.list
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get \
  install --yes \
  make \
  golang-1.17 \
  git \
  curl \
  e2fsprogs \
  util-linux \
  bc \
  gnupg

# Install go version 1.22.1 (for request-queue)
wget https://golang.org/dl/go1.22.1.linux-amd64.tar.gz
sudo rm -rf /usr/local/go1.22 && sudo tar -C /usr/local -xzf go1.22.1.linux-amd64.tar.gz
sudo mv /usr/local/go /usr/local/go1.22
alias go1.22='/usr/local/go1.22/bin/go'
rm go1.22.1.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go1.22/bin' >> ~/.bashrc
source ~/.bashrc

echo 'export PATH=/usr/lib/go-1.17/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

cd ~

# Install Docker CE
# Docker CE includes containerd, but we need a separate containerd binary, built
# in a later step
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
apt-key finger docker@docker.com | grep '9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88' || echo '**Cannot find Docker key**'
echo "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
     sudo tee /etc/apt/sources.list.d/docker.list
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get \
     install --yes \
     docker-ce aufs-tools-
sudo usermod -aG docker $(whoami)

# Install device-mapper
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y dmsetup