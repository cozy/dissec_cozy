import { translate, useI18n } from 'cozy-ui/react/I18n'
import Nav, { NavItem, NavText } from 'cozy-ui/transpiled/react/Nav'
import React from 'react'
import { NavLink } from 'react-router-dom'
import Sidebar from 'cozy-ui/transpiled/react/Sidebar'

const navItems = [
  { to: '/operations', translation: 'Nav.operations' },
  { to: '/execution', translation: 'Nav.execution' },
  { to: '/nodes', translation: 'Nav.nodes' },
  { to: '/supervisor', translation: 'Nav.supervisor' },
  { to: '/demonstration', translation: 'Nav.demonstration' }
]

export const AppSidebar = () => {
  const { t } = useI18n()
  return (
    <Sidebar>
      <Nav>
        {navItems.map(item => (
          <NavItem key={item.to}>
            <NavLink to={item.to} className="c-nav-link">
              <NavText>{t(item.translation)}</NavText>
            </NavLink>
          </NavItem>
        ))}
      </Nav>
    </Sidebar>
  )
}

export default translate()(AppSidebar)
