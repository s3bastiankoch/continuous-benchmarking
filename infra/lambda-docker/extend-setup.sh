clientInstanceName="lambda-emulator"
zone="europe-west1-b"

sut_ip="$(gcloud compute instances describe $clientInstanceName --zone=$zone --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
echo "SUT IP is" $sut_ip

# Copy Request queue to emulator
echo "Copying request queue to emulator.."
gcloud compute scp --recurse $PWD/../../request-queue $clientInstanceName:~/ --zone $zone >> /dev/null

echo "Building docker image on emulator instance.."
gcloud compute ssh $clientInstanceName --zone $zone -- "cd request-queue && sudo docker build -t request-queue ."

# Copy lambda to emulator
echo "Copying lambda to emulator.."
#  Create a new directory on the emulator instance
gcloud compute ssh $clientInstanceName --zone $zone -- "mkdir -p serverless-ts"
gcloud compute scp --recurse $PWD/../../examples/serverless-ts/src $clientInstanceName:~/serverless-ts --zone $zone >> /dev/null
gcloud compute scp $PWD/../../examples/serverless-ts/package.json $clientInstanceName:~/serverless-ts --zone $zone >> /dev/null
gcloud compute scp $PWD/../../examples/serverless-ts/pnpm-lock.yaml $clientInstanceName:~/serverless-ts --zone $zone >> /dev/null
gcloud compute scp $PWD/../../examples/serverless-ts/Dockerfile $clientInstanceName:~/serverless-ts --zone $zone >> /dev/null

echo "Building docker image on emulator instance.."
gcloud compute ssh $clientInstanceName --zone $zone -- "cd serverless-ts && sudo docker build --platform linux/amd64 -t lambda ."

# Copy docker-compose file to emulator
echo "Copying docker-compose file to emulator.."
gcloud compute scp $PWD/docker-compose.yml $clientInstanceName:~ --zone $zone >> /dev/null

# Run docker-compose on emulator
echo "Running docker compose on emulator.."
gcloud compute ssh $clientInstanceName --zone $zone -- "sudo docker compose up -d"

echo "Done!"