[![Travis build status shield](https://img.shields.io/travis/JulienMirval/dissec_cozy/master.svg)](https://travis-ci.org/JulienMirval/dissec_cozy)
[![Github Release version shield](https://img.shields.io/github/tag/JulienMirval/dissec_cozy.svg)](https://github.com/JulienMirval/dissec_cozy/releases)
[![jest](https://facebook.github.io/jest/img/jest-badge.svg)](https://github.com/facebook/jest)


# DISSEC-COZY

## What's DISSEC-COZY?

DISSEC-COZY is a proof-of-concept implementation of DISSEC-ML, the academic work done by Cozy and PETRUS.

It is a decentralized aggregation protocol designed to be used for privacy-preserving machine learning. Nodes locally learn a model and then use a simple additively homomorphic secret-sharing scheme to send data to aggregators. Aggregators form a tree to maximize efficiency.

## Setup

_:pushpin: Note:_ we recommend to use [Yarn] instead of NPM for package management. Don't hesitate to [install][yarn-install] and use it for your Cozy projects, it's now our main node packages tool for Cozy official apps.

### Install

Setting up the Cozy DISSEC-COZY app requires you to [setup a dev environment][setup]. However, you will need a spcific version of `cozy-stack`, so we recommend that you install it from sources and run `git checkout 3bca7d384076a21367c24bf69f5381ad9e54223b` before running `make`.

You can then clone the app repository and install dependencies:

```sh
$ git clone https://github.com/JulienMirval/dissec_cozy.git
$ cd dissec_cozy
$ yarn install
```

:pushpin: If you use a node environment wrapper like [nvm] or [ndenv], don't forget to set your local node version before doing a `yarn install`.

Cozy's apps use a standard set of _npm scripts_ to run common tasks, like watch, lint, test, build…

If you want to check that everything is working smoothly, you can check [integration test](#tests).
If you want to see how the protocol works in details, run the [demonstrattion](#demonstration).

### Configuration

In order to allow continuous enhancement of performances, nodes in the protocol can start training from a pretrained model, which is the result of the last training.

Currently, this model is stored on the local file system and the path needs to be defined for the execution to work. In the file `dissec.config.json`, set the `localModelPath` value to a path where you want this shared model to be stored.

Also, you need to add a line in the `cozy.yml` configuration of the Cozy Stack to serve the model as a remote asset. The remote asset of the model currently NEEDS to be called `dissec_model`.

Before: 
```yaml
remote_assets:
  bank: https://myassetserver.com/remote_asset.json
```

After: 
```yaml
remote_assets:
  dissec_model: file:///home/dode/cozy/models/model.data
```

### Tests

Tests are run by [jest] under the hood. You can easily run the unit tests suite with:

```sh
$ cd dissec_cozy
$ yarn test
```

There are also integration tests that verify that the trainings and predictions work as expected.
The Cozy-stack needs to be running for integration tests to work.
They can be ran with:

```sh
$ yarn test:integration
```

It currently tests the following properties:

- A distributed training where the union of individuals dataset is equal to the dataset used by a single participant to train a local model give the same accuracy.

:pushpin: Don't forget to update / create new tests when you contribute to code to keep the app the consistent.

## Demonstration

A test scenario has been developed to test the protocol with multiple instances.
It is currently static and will involves 11 nodes: 7 nodes will contribute a single data to the protocol, 3 nodes will serve as intermediate aggregators and the querier (the default instance of the stack) will act as the querier, creating the tree and triggerring contributors.

The steps to to execute the demonstration are as follows:

1. Have a `build` folder in the in the `dissecozy` repo. For development purposes, you can run a `yarn watch` command, which will look for updates in the repo and automatically build the latest version. Else, run `yarn build`.
2. Launch `cozy-stack serve --disable-csp` to start the stack with the dissecozy app loaded.
3. Create test instances by running `yarn run populate`. This will create the 10 test instances (`test1.cozy.localhost:8080` to `test10.cozy.localhost:8080`) and automatically provides 10 banking operations of 10 different categories by default. It will also output a JSON file containing all these instances' webhooks, and uploads these webhooks to the querier to use them to construct the aggregation tree. The file is located in `generated/webhooks.json`.
4. Open a browser and go to the dissecozy URL of your default instance (e.g. `http://dissecozy.cozy.localhost:8080/`)
5. In the *Nodes* section, click the 'Choose a file' button and select the JSON file containing webhooks. Then, click upload to register all the test instances to the querier.
6. Go to the *Execution* section and, in the *Full Aggregation* sub section, first click the 'Generate new tree' button, then 'Launch execution' button.

Congratulations, you launched the execution. After a few seconds, you should see new file created at the location indicated by `localModelPath` value of `dissec.config.json` file.

The command `yarn run measure` can be used to demonstrate the efficiency of distributed learning.
It runs both type of learning and measures the accuracy on a single validation dataset.
This script implies that `yarn run populate` has been run before.

## Simulation

In order to obtain experimental results, a [simulation](simulation/README.md) has been done.
It aims to simulate only the phase of the protocol spanning from contacting contributors to the querier recomposing the final result.
It abstracts the network overlay and assumes the tree construction, as presented in [the paper](https://dl.acm.org/doi/abs/10.1145/3468791.3468821?casa_token=JghDDbwYFtYAAAAA:SwWawr7gz0QmwOc_iCvV_HmrfB8qAcK9IvuWuhCgMfko33o_g7o6NOyjVHqUsgbfwaUPyouSGboLiGI), is already done.

The simulation starts in the following state:
- All the aggregators (leaf aggregators and querier included) start the process of monitoring their children's health with periodic pings
- The first member of each leaf aggregator group sends a request to all its associated contributors to send their data to its group.

The simulator has two components: the simulator itself and a visualization dashboard.

### Usage

1. `cd simulation`
2. Rename `example.dissec.config.json` to `dissec.config.json` and fill it properly
3. `yarn install`
4. `yarn start`

The simulation has executed and the results are stored at the path indicated by `dissec.config.json`

To launch the dashboard:
1. `pip install requirements.txt`
2. `yarn dashboard`
3. Open your browser at [localhost:8050](http://localhost:8050)

## Models

The Cozy datastore stores documents, which can be seen as JSON objects. A `doctype` is simply a declaration of the fields in a given JSON object, to store similar objects in an homogeneous fashion.

Cozy ships a [built-in list of `doctypes`][doctypes] for representation of most of the common documents (Bills, Contacts, Files, ...).

DISSEC-COZY uses the following additionnal doctypes:

- `dissec.nodes` is used to register instances willing to participate in the protocol, so that the querier can organize them to create an efficient tree.

### Open a Pull-Request

If you want to work on DISSEC-COZY and submit code modifications, feel free to open pull-requests! See the [contributing guide][contribute] for more information about how to properly open pull-requests.

## Community

### What's Cozy?

<div align="center">
  <a href="https://cozy.io">
    <img src="https://cdn.rawgit.com/cozy/cozy-site/master/src/images/cozy-logo-name-horizontal-blue.svg" alt="cozy" height="48" />
  </a>
 </div>
 </br>

[Cozy] is a platform that brings all your web services in the same private space.  With it, your webapps and your devices can share data easily, providing you with a new experience. You can install Cozy on your own hardware where no one's tracking you.

### Localization

Localization and translations are handled by [Transifex][tx], which is used by all Cozy's apps.

As a _translator_, you can login to [Transifex][tx-signin] (using your Github account) and claim an access to the [app repository][tx-app]. Locales are pulled when app is build before publishing.

As a _developer_, you must [configure the transifex client][tx-client], and claim an access as _maintainer_ to the [app repository][tx-app]. Then please **only update** the source locale file (usually `en.json` in client and/or server parts), and push it to Transifex repository using the `tx push -s` command.


### Maintainer

The lead maintainer for DISSEC-COZY is [Julien Mirval](https://github.com/JulienMirval), send him/her a :beers: to say hello!


### Get in touch

You can reach the Cozy Community by:

- Chatting with us on IRC [#cozycloud on Freenode][freenode]
- Posting on our [Forum][forum]
- Posting issues on the [Github repos][github]
- Say Hi! on [Twitter][twitter]


## License

DISSEC-COZY is developed by Julien Mirval and distributed under the [AGPL v3 license][agpl-3.0].

[cozy]: https://cozy.io "Cozy Cloud"
[setup]: https://dev.cozy.io/#set-up-the-development-environment "Cozy dev docs: Set up the Development Environment"
[yarn]: https://yarnpkg.com/
[yarn-install]: https://yarnpkg.com/en/docs/install
[cozy-ui]: https://github.com/cozy/cozy-ui
[cozy-client-js]: https://github.com/cozy/cozy-client-js/
[cozy-stack-docker]: https://github.com/cozy/cozy-stack/blob/master/docs/client-app-dev.md#with-docker
[doctypes]: https://cozy.github.io/cozy-doctypes/
[bill-doctype]: https://github.com/cozy/cozy-konnector-libs/blob/master/models/bill.js
[konnector-doctype]: https://github.com/cozy/cozy-konnector-libs/blob/master/models/base_model.js
[konnectors]: https://github.com/cozy/cozy-konnector-libs
[agpl-3.0]: https://www.gnu.org/licenses/agpl-3.0.html
[contribute]: CONTRIBUTING.md
[tx]: https://www.transifex.com/cozy/
[tx-signin]: https://www.transifex.com/signin/
[tx-app]: https://www.transifex.com/cozy/<SLUG_TX>/dashboard/
[tx-client]: http://docs.transifex.com/client/
[freenode]: http://webchat.freenode.net/?randomnick=1&channels=%23cozycloud&uio=d4
[forum]: https://forum.cozy.io/
[github]: https://github.com/cozy/
[twitter]: https://twitter.com/cozycloud
[nvm]: https://github.com/creationix/nvm
[ndenv]: https://github.com/riywo/ndenv
[jest]: https://facebook.github.io/jest/
