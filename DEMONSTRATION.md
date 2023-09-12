# DISSEC-COZY demonstration guide

Below are all the instructions to launch the demonstrator.
The setup was done on [Ubuntu-22.04](https://ubuntu.com/download) in [Window Subsystem Linux(WSL)](https://learn.microsoft.com/en-us/windows/wsl/install) but should work exactly like a native Ubuntu setup.

The demonstrator is composed of two parts:

- The [Cozy Stack](https://github.com/cozy/cozy-stack) is the piece of software that hosts all user's Cozy instances. Each instance is an isolated PDMS. The Cozy Stack is in charge of running jobs and sending queries to instances.
- Apps for the Cozy Stack like [DISSEC-COZY](./README.md) are web apps built in [React](https://react.dev/). Apps are then installed by the Stack to be served to users when they connect to their instance. Apps come with a manifest that declares their data dependencies and all the workload they require.

## Resources

- A [video explanation](https://julienmirval-drive.mycozy.cloud/public?sharecode=FqInzVlrglWK) is available to accompany the demonstrator. It outlines the context in which this was built as well as some illustrated instructions on how to use the demonstrator.

## Setup

### Cozy Stack

The Cozy Stack is a [Go](https://go.dev/) server.
For the purpose of the demonstrator, we will need to install a specific version of the Stack that will require building from sources.

1. Download and install the latest version of [Go](https://go.dev/doc/install) and add it to your `PATH`
2. Install [CouchDB](https://docs.couchdb.org/en/stable/install/index.html)
3. Clone the Cozy Stack repo: `git clone https://github.com/cozy/cozy-stack`
3. `cd cozy-stack`
5. Select the right version of the Stack `git checkout 3bca7d384076a21367c24bf69f5381ad9e54223b`
6. `make`
7. Add your GOPATH to your path: `export PATH="$(go env GOPATH)/bin:$PATH"`
8. Create configurations `mkdir touch $HOME/.cozy/ && touch $HOME/.cozy/cozy.yaml && touch $HOME/.cozy/node-run.sh && chmod 755 ~/.cozy/node-run.sh`
9. Add and update the following lines in `~/.cozy/cozy.yaml`: 
```yaml
konnectors:
    cmd: ~/.cozy/node-run.sh

couchdb:
    url: http://admin:password@localhost:5984/ # Replace the right password
```
9. Add the following lines in `~/.cozy/node-run.sh`:
```sh
rundir="${1}"
cd $rundir
# Uncomment the line depending on your setup
# node "index.js" | tee -a ~/.cozy/services.log
~/.nvm/versions/node/v16.*/bin/node "index.js" | tee -a ~/.cozy/services.log
```


The Cozy Stack should now be available from the command line (verify by running `cozy-stack version` without errors).

### DISSEC-COZY

Building the app requires [Node.js](https://nodejs.org/en) (16.20.2 recommended). For the package manager, we recommend using [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable).
You can then clone the app repository (if you haven't already) and install dependencies:

```sh
$ git clone https://github.com/cozy/dissec_cozy.git
$ cd dissec_cozy
$ yarn install
$ cp dissec.config.example.json dissec.config.json
```

:pushpin: If you use a node environment wrapper like [nvm] or [ndenv], don't forget to set your local node version before doing a `yarn install`.

Cozy's apps use a standard set of _npm scripts_ to run common tasks, like watch, lint, test, build…

### Configuration

To function, the demonstrator needs a place to store the globally trained model.
You need to define where this model will be stored by setting the `localModelPath` field in a `dissec.config.json` file positionned at the root of the repository.
The path to the model **needs to be an absolute path**.

### Loading demonstration data

We now need to create the instances used for our demonstration and load some data in them.

1. Start the Cozy Stack: `cozy-stack serve --disable-csp`
2. The first time, create a main instance by running: `cozy-stack instances add --passphrase cozy --apps drive,photos,settings,home,store cozy.localhost:8080`
2. In another terminal, build the app: `yarn watch`
3. In another terminal, install the app once built: `cozy-stack apps install dissecozy file:///absolute/path/to/your/build/dir`. The build directory is at the root of the repository.
4. Launch the population script: `yarn populate:demo`

You are now ready to go!

## Running the demonstration

1. Navigate to [dissecozy.cozy.localhost:8080](http://dissecozy.cozy.localhost:8080). You should see a list of banking operations. One of them is manually classified.
2. Navigate to [the execution page](http://dissecozy.cozy.localhost:8080/#/execution). Untoggle "Use model from distributed training?" and click "LAUNCH CLASSIFICATION".
3. Go back to [operations](http://dissecozy.cozy.localhost:8080). Nothing changed because the model is not good enough to make predictions about unknown operations.
4. Go to [the demonstration](http://dissecozy.cozy.localhost:8080/#/demonstration). You can change the shape of the tree. Wait for the tree status to stay at `Idle` and then click "LAUNCH EXECUTION". Wait for the tree to be completely green.
5. Go back to [the execution page](http://dissecozy.cozy.localhost:8080/#/execution). Click "LAUNCH CLASSIFICATION" while leaving the toggle on.
6. Go back to [operations](http://dissecozy.cozy.localhost:8080). The remaining operations should be green now. Thanks to data from other nodes. No PDMS collected usable private data.

## Troubleshooting

### Error: error:0308010C:digital envelope routines::unsupported

Downgrade to Node.js 16 using `nvm` (needs to be installed) by running `nvm install && nvm use`

### Instances cannot be reached

Add these lines to your `/etc/hosts` file:

```
127.0.0.1       cozy.localhost
127.0.0.1       test1.localhost
127.0.0.1       test2.localhost
127.0.0.1       test3.localhost
127.0.0.1       test4.localhost
127.0.0.1       test5.localhost
127.0.0.1       test6.localhost
127.0.0.1       test7.localhost
127.0.0.1       test8.localhost
127.0.0.1       test9.localhost
127.0.0.1       test10.localhost
```

### Demonstration does not start

Some browsers and plugins can block requests. Make them to disable them when using the demonstrator.

### Model is not written

If after a distributed training, the model indicated in the `dissec.config.json`, you can try writing a dummy file at the same place, to make sure the path is reachable.