import { translate } from 'cozy-ui/react/I18n'
import Icon from 'cozy-ui/react/Icon'
import React from 'react'
import { NavLink } from 'react-router-dom'

import NavIcon from 'assets/icons/icon-bullet-point.svg'

const navItems = [
  { to: '/operations', translation: 'Nav.operations' },
  { to: '/execution', translation: 'Nav.execution' },
  { to: '/nodes', translation: 'Nav.nodes' },
  { to: '/supervisor', translation: 'Nav.supervisor' }
]

export const Sidebar = ({ t }) => {
  return (
    <aside className="o-sidebar">
      <nav>
        <ul className="c-nav">
          {navItems.map(item => (
            <li className="c-nav-item" key={item.to}>
              <NavLink
                to={item.to}
                className="c-nav-link"
                activeClassName="is-active"
              >
                <Icon className="c-nav-icon" icon={NavIcon} />
                {t(item.translation)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

// translate() provide t() to use translations (ex: locales/en.json)
export default translate()(Sidebar)
