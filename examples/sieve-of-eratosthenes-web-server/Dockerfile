FROM public.ecr.aws/lambda/nodejs:20 as builder
WORKDIR /usr/app

COPY package.json  ./
COPY src ./src
RUN npm install
RUN npm run build
    
FROM public.ecr.aws/docker/library/node:20-slim

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=7000

WORKDIR "/var/task"

COPY --from=builder /usr/app/dist/* ./

ARG N=0
ENV N_ITERATIONS=$N

CMD ["node", "index.js"]

