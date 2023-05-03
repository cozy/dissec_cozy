import 'cozy-ui/dist/cozy-ui.utils.min.css'
import 'cozy-ui/transpiled/react/stylesheet.css'

import CozyClient, { CozyProvider } from 'cozy-client'
import { Sprite as IconSprite } from 'cozy-ui/react/Icon'
import { Content, Layout, Main } from 'cozy-ui/react/Layout'
import React from 'react'
import { hot } from 'react-hot-loader'
import { HashRouter, Redirect, Route, Switch } from 'react-router-dom'

import Execution from './Execution'
import Nodes from './Nodes'
import Operations from './Operations'
import Supervisor from './Supervisor'
import Demonstration from './Demonstration'
import Sidebar from './Sidebar'

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
                <Route path="/supervisor" component={Supervisor} />
                <Route path="/demonstration" component={Demonstration} />
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
