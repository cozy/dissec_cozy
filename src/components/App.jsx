import React from 'react'
import { hot } from 'react-hot-loader'
import { Route, Switch, Redirect, HashRouter } from 'react-router-dom'
import { Layout, Main, Content } from 'cozy-ui/react/Layout'
import { Sprite as IconSprite } from 'cozy-ui/react/Icon'
import CozyClient, { CozyProvider } from 'cozy-client'

import Sidebar from './Sidebar'
import Execution from './Execution'
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
                <Route path="/execution" component={Execution} />
                <Route path="/analyze" component={Analyze} />
                <Redirect from="/" to="/execution" />
                <Redirect from="*" to="/execution" />
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
