import React from 'react'
import { hot } from 'react-hot-loader'
import { Route, Switch, Redirect, HashRouter } from 'react-router-dom'
import { Layout, Main, Content } from 'cozy-ui/react/Layout'
import { Sprite as IconSprite } from 'cozy-ui/react/Icon'
import CozyClient, { CozyProvider } from 'cozy-client'

import 'cozy-ui/transpiled/react/stylesheet.css'
import 'cozy-ui/dist/cozy-ui.utils.min.css'

import Sidebar from './Sidebar'
import Operations from './Operations'
import Execution from './Execution'
import Nodes from './Nodes'
import Analyze from './Analyze'

const App = () => {
  const client = CozyClient.fromDOM()

  return (
    <HashRouter>
      <CozyProvider client={client}>
        <Layout>
          <Sidebar />
          <Main>
            <Content className="app-content">
              <Switch>
                <Route path="/operations" component={Operations} />
                <Route path="/execution" component={Execution} />
                <Route path="/nodes" component={Nodes} />
                <Route path="/analyze" component={Analyze} />
                <Redirect from="/" to="/operations" />
                <Redirect from="*" to="/operations" />
              </Switch>
            </Content>
          </Main>
          <IconSprite />
        </Layout>
      </CozyProvider>
    </HashRouter>
  )
}

/*
  Enable Hot Module Reload using `react-hot-loader` here
  We enable it here since App is the main root component
  No need to use it anywhere else, it sould work for all
  child components
*/
export default hot(module)(App)
