#!/bin/bash

# This script is used to populate the stack with cozy instances
# It requires updating /etc/hosts

if [ $# != 1 ]
then
    echo "Wrong number of arguments!"
    echo "Usage: populate [number of instances to create]"
    return
fi

current_path="/mnt/c/Users/jumic/Projets/Cozy/dissec_cozy/scripts"
stack_path="/mnt/c/Users/jumic/Projets/Cozy/cozy-stack"

# domain="test1.cozy.localhost:8080"
# cd $stack_path
# token=$(go run main.go instances token-app ${domain} dissecozy)
# cd $current_path
# node webhooks.js http://${domain} ${token} ../data/webhooks.json

echo "Clearing old webhooks data..."
rm ./data/webhooks.json

for i in `seq 1 ${1}`
do
    domain="test${i}.cozy.localhost:8080"
    echo "Creating instance ${domain}"

    cd $stack_path
    
    # Destroy the instance in case it already exists
    go run main.go instances destroy ${domain} --force
    # Create a new instance
    go run main.go instances add --apps drive,photos ${domain} --passphrase cozy
    go run main.go instances modify ${domain} --onboarding-finished

    cd $current_path
    # Split our dataset in chunks
    node split.js ../data/split.json 5
    # Populate the instance with data using ACH. Helper will randomly select samples
    ACH import ../data/split.json
    cd $stack_path
    # Install the app
    go run main.go apps install --domain ${domain} dissecozy file:///mnt/c/Users/jumic/Projets/Cozy/dissec_cozy/build/
    token=$(go run main.go instances token-app ${domain} dissecozy)
    cd $current_path
    # Fetch webhooks
    # token=$(ACH token --url http://${domain} io.cozy.dissec.nodes)
    node webhooks.js http://${domain} ${token} ../data/webhooks.json
done
