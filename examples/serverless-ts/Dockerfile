FROM public.ecr.aws/lambda/nodejs:18 as builder
WORKDIR /usr/app

COPY package.json  ./
COPY src ./src
RUN npm install
RUN npm run build
    
FROM public.ecr.aws/lambda/nodejs:18
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./

ARG N=0
ENV N_ITERATIONS=$N

CMD ["index.handler"]