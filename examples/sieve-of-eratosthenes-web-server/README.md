# Lambda TypeScript Example

A simple lambda function that calculates PI using the Monte Carlo method.

## How to use it?

Build the function:

```sh
docker build --platform linux/amd64 -t lambda-test .
```

Run the function:

```sh
docker run -d --platform linux/amd64 -p 8080:7000 -t lambda-test
```

Or:

```sh
sam build && sam local start-api
```
