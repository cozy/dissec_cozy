#!/bin/bash

# This script is used to populate the stack with cozy instances
# It requires updating /etc/hosts

if [ $# != 1 ]
then
    echo "Wrong number of arguments!"
    echo "Usage: populate [number of instances to create]"
    return
fi

repository=$(pwd)
cd ${repository}/scripts

echo "Clearing old webhooks data..."
rm ../assets/webhooks.json

for i in `seq 1 ${1}`
do
    domain="test${i}.localhost:8080"
    echo "Creating instance ${domain}"
    # Destroy the instance in case it already exists
    cozy-stack instances destroy ${domain} --force
    # Create a new instance
    cozy-stack instances add --apps drive,photos ${domain} --passphrase cozy
    cozy-stack instances modify ${domain} --onboarding-finished
    # Generate token first
    ACH_token=$(cozy-stack instances token-cli ${domain} io.cozy.bank.operations)
    # Split our dataset in chunks (deterministic)
    node split.js ../assets/split.json ${i}
    # Populate the instance with data using ACH. Helper will randomly select samples
    ACH -u http://${domain} -y import ../assets/split.json -t ${ACH_token}
    # Generate a token
    token=$(cozy-stack instances token-app ${domain} dissecozy)
    # Install the app
    cozy-stack apps install --domain ${domain} dissecozy file://${repository}/build/
    # Fetch webhooks
    node webhooks.js http://${domain} ${token} ../assets/webhooks.json
done
