# Simple Request Queue

A very simple request queue that solves the problem of concurrency in emulated lambda functions.

```sh
docker build -t request-queue:latest .
```

```sh
docker run -d -p 80:80 -e LAMBDA1_ADDRESS= -e LAMBDA2_ADDRESS= --name request-queue request-queue:latest
```
