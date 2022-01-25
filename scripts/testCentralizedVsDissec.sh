#!/bin/bash

# This script is used to populate the stack with cozy instances
# It requires updating /etc/hosts when using WSL

repository=$(pwd)

n_instances=10
operations_per_instances=${1:-10}
fixture_file=${2:-"./assets/fixtures-l.json"}

echo "Clearing old webhooks data..."
rm ./assets/webhooks.json

classes_dissec=($(node ./scripts/splitClasses.js 9 10))
classes_centralized=($(node ./scripts/splitClasses.js 1 90))

for i in $(seq 1 ${n_instances}); do
  domain="test${i}.localhost:8080"
  echo "Creating instance ${domain}"
  # Destroy the instance in case it already exists
  cozy-stack instances destroy ${domain} --force
  # Create a new instance
  cozy-stack instances add --apps drive,photos ${domain} --passphrase cozy
  cozy-stack instances modify ${domain} --onboarding-finished
  # Generate token first
  ACH_token=$(cozy-stack instances token-cli ${domain} io.cozy.bank.operations)
  # Populate the instance with data using ACH. Helper will randomly select samples
  if [ ${i} -eq 1 ]; then
    total_data=$((${operations_per_instances} * 9))
    echo "Importing ${total_data} data of all the classes: ${classes_centralized[$i - 1]}"
    for j in $(seq 1 $((${n_instances} - 1)) ); do
      echo "Classes batch: ${classes_dissec[$j - 1]}"
      ACH -u http://${domain} -y script banking/importFilteredOperations \
        ${fixture_file} ${classes_dissec[$j - 1]} ${operations_per_instances} \
        -x -t ${ACH_token}
    done
  else
    echo "Importing ${operations_per_instances} data of classes: ${classes_dissec[$i - 2]}"
    ACH -u http://${domain} -y script banking/importFilteredOperations \
      ${fixture_file} ${classes_dissec[$i - 2]} ${operations_per_instances} \
      -x -t ${ACH_token}
  fi
  # Generate a token
  token=$(cozy-stack instances token-app ${domain} dissecozy)
  # Install the app
  cozy-stack apps install --domain ${domain} dissecozy file://${repository}/build/
  # Fetch webhooks
  node ./scripts/webhooks.js http://${domain} ${token} ./assets/webhooks.json
done

# Upload new instances webhooks to the querier instance
echo "Updating the querier with fresh webhooks..."
token=$(cozy-stack instances token-app cozy.localhost:8080 dissecozy)
node ./scripts/loadWebhooks.js http://cozy.localhost:8080 ${token}

# Measuring performances
echo "Starting performance measurements..."
token=$(cozy-stack instances token-app test1.localhost:8080 dissecozy)
node ./scripts/localVsDissecLearning.js http://test1.localhost:8080 ${token} true
