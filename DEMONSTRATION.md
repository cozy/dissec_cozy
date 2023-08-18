# DISSEC-COZY demonstration guide

Below are all the instructions to launch the demonstrator.
The setup was done on [Ubuntu-22.04](https://ubuntu.com/download) in [Window Subsystem Linux(WSL)](https://learn.microsoft.com/en-us/windows/wsl/install) but should work exactly like a native Ubuntu setup.

The demonstrator is composed of two parts:

- The [Cozy Stack](https://github.com/cozy/cozy-stack) is the piece of software that hosts all user's Cozy instances. Each instance is an isolated PDMS. The Cozy Stack is in charge of running jobs and sending queries to instances.
- Apps for the Cozy Stack like [DISSEC-COZY](./README.md) are web apps built in [React](https://react.dev/). Apps are then installed by the Stack to be served to users when they connect to their instance. Apps come with a manifest that declares their data dependencies and all the workload they require.

## Setup

### Cozy Stack

The Cozy Stack is a [Go](https://go.dev/) server.
For the purpose of the demonstrator, we will need to install a specific version of the Stack that will require building from sources.

1. Download and install the latest version of [Go](https://go.dev/doc/install)
2. Clone the Cozy Stack repo: `git clone https://github.com/cozy/cozy-stack`
3. `cd cozy-stack`
4. Select the right version of the Stack `git checkout 3bca7d384076a21367c24bf69f5381ad9e54223b`
5. `make`

The Cozy Stack should now be available from the command line (verify by running `cozy-stack version` without errors).

### DISSEC-COZY

Building the app requires [Node.js](https://nodejs.org/en). For the package manager, we recommend using [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable).
You can then clone the app repository (if you haven't already) and install dependencies:

```sh
$ git clone https://github.com/cozy/dissec_cozy.git
$ cd dissec_cozy
$ yarn install
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
2. In another terminal, build the app: `yarn watch`
3. In another terminal, install the app once built: `cozy-stack apps install dissecozy file:///absolute/path/to/your/build/dir`. The build directory is at the root of the repository.
4. Launch the population script: `yarn populate:demo`

You are now ready to go!

## Running the demonstration

You can simply navigate to [cozy.localhost:8080](http://cozy.localhost:8080) in your browser and the app should appear!

## Troubleshooting

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

### Model is not written

If after a distributed training, the model indicated in the `dissec.config.json`, you can try writing a dummy file at the same place, to make sure the path is reachable.