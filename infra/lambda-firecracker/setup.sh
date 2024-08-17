#!/bin/bash

# Logs can be checked with sudo journalctl -u google-startup-scripts.service

# Setup firecracker-containerd configuration
/home/sebastian/firecracker-containerd.sh

# Start firecracker containerd detached
sudo nohup firecracker-containerd --config /etc/firecracker-containerd/config.toml &

# Wait until serverless-ts folder is created
while [ ! -d /home/empiris/serverless-ts ]; do
  sleep 1
done
 
# TODO: Read the latest 2 versions of the serverless-ts image

# Start the lambda containers
cd /home/empiris/serverless-ts

docker build --build-arg="N=500000" -t serverless-ts-a:latest .
# docker build --build-arg="N=525000" -t serverless-ts-b:latest .
# docker build --build-arg="N=5000000" -t serverless-ts-a:latest .
# docker build --build-arg="N=5250000" -t serverless-ts-b:latest .

sudo docker save -o serverless-ts-a.tar serverless-ts-a:latest
# sudo docker save -o serverless-ts-b.tar serverless-ts-b:latest

sudo firecracker-ctr --address /run/firecracker-containerd/containerd.sock \
	 image import \
	 --snapshotter devmapper \
	 serverless-ts-a.tar

# sudo firecracker-ctr --address /run/firecracker-containerd/containerd.sock \
# 	 image import \
# 	 --snapshotter devmapper \
# 	 serverless-ts-b.tar

sudo firecracker-ctr --address /run/firecracker-containerd/containerd.sock \
	 run \
	 --snapshotter devmapper \
	 --runtime aws.firecracker \
	 --net-host \
	 --cpu-shares 2048 \
	 --cpus 2 \
	 --memory-limit 1024000000 \
	 --detach \
	 docker.io/library/serverless-ts-a:latest \
	 lambda-a

# sudo firecracker-ctr --address /run/firecracker-containerd/containerd.sock \
# 	 run \
# 	 --snapshotter devmapper \
# 	 --runtime aws.firecracker \
# 	 --net-host \
# 	 --cpus 1 \
# 	 --cpu-shares 2048 \
# 	 --memory-limit 1024000000 \
# 	 --detach \
# 	 docker.io/library/serverless-ts-b:latest \
# 	 lambda-b

# Start the request queue, detached as well
cd /home/empiris/request-queue
# Note go version is 1.22 in this case
# export GOPATH=/usr/local/go1.22/bin/go
# sudo nohup /usr/local/go1.22/bin/go run main.go &

# Build the request queue image
sudo docker build -t request-queue:latest .

# Run the request queue container with docker (NOTE: We give it 1 core to avoid conflicts with the lambdas)
# sudo docker run -d --network="host" --cpuset-cpus 1 --name request-queue request-queue:latest
sudo docker run -d --network="host" --name request-queue request-queue:latest