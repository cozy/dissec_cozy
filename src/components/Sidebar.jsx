import { useI18n } from 'cozy-ui/react/I18n'
import Nav, { NavItem, NavIcon, NavText } from 'cozy-ui/transpiled/react/Nav'
import React from 'react'
import { NavLink } from 'react-router-dom'
import Sidebar from 'cozy-ui/transpiled/react/Sidebar'
import BillIcon from 'cozy-ui/transpiled/react/Icons/Bill'
import FitnessIcon from 'cozy-ui/transpiled/react/Icons/Fitness'
import RepareIcon from 'cozy-ui/transpiled/react/Icons/Repare'
import DashboardIcon from 'cozy-ui/transpiled/react/Icons/Dashboard'
import ShareCircleIcon from 'cozy-ui/transpiled/react/Icons/ShareCircle'

const navItems = [
  { to: '/operations', translation: 'Nav.operations', icon: BillIcon },
  { to: '/demonstration', translation: 'Nav.demonstration', icon: FitnessIcon },
  { to: '/execution', translation: 'Nav.execution', icon: RepareIcon },
  { to: '/nodes', translation: 'Nav.nodes', icon: ShareCircleIcon },
  { to: '/supervisor', translation: 'Nav.supervisor', icon: DashboardIcon }
]

export const AppSidebar = () => {
  const { t } = useI18n()
  return (
    <Sidebar id="sidebar" style={{ paddingBottom: '12px' }}>
      <Nav>
        {navItems.map(item => (
          <NavItem key={item.to} style={{ display: 'flex', padding: '0.5rem' }}>
            <NavLink
              to={item.to}
              style={{ display: 'flex', width: '100%', height: '100%' }}
              activeStyle={{
                borderLeft: '2px var(--invertedBackgroundColor)'
              }}
            >
              <div
                style={{
                  margin: 'auto',
                  width: '100%'
                }}
              >
                <NavIcon icon={item.icon} style={{ verticalAlign: 'middle' }} />
                <NavText>{t(item.translation)}</NavText>
              </div>
            </NavLink>
          </NavItem>
        ))}
      </Nav>
    </Sidebar>
  )
}

export default AppSidebar
