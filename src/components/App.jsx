import { RealTimeQueries } from 'cozy-client'
import { Content, Layout, Main } from 'cozy-ui/react/Layout'

import React from 'react'
import { hot } from 'react-hot-loader'
import { HashRouter, Redirect, Route, Switch } from 'react-router-dom'

import Execution from './Execution'
import Nodes from './Nodes'
import Operations from './Operations'
import Supervisor from './Supervisor'
import Demonstration from './Demonstration'
import { OBSERVATIONS_DOCTYPE, BANK_OPERATIONS_DOCTYPE } from 'doctypes'
import { AppSidebar } from './Sidebar'

const App = () => {
  return (
    <HashRouter>
      <Layout>
        <RealTimeQueries doctype={OBSERVATIONS_DOCTYPE} />
        <RealTimeQueries doctype={BANK_OPERATIONS_DOCTYPE} />
        <AppSidebar />
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
        {/* <IconSprite /> */}
      </Layout>
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
