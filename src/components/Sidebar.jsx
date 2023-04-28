import { translate } from 'cozy-ui/react/I18n'
import Icon from 'cozy-ui/react/Icon'
import React from 'react'
import { NavLink } from 'react-router-dom'

import NavIcon from 'assets/icons/icon-bullet-point.svg'

export const Sidebar = ({ t }) => {
  return (
    <aside className="o-sidebar">
      <nav>
        <ul className="c-nav">
          <li className="c-nav-item">
            <NavLink
              to="/operations"
              className="c-nav-link"
              activeClassName="is-active"
            >
              <Icon className="c-nav-icon" icon={NavIcon} />
              {t('Nav.operations')}
            </NavLink>
          </li>
          <li className="c-nav-item">
            <NavLink
              to="/execution"
              className="c-nav-link"
              activeClassName="is-active"
            >
              <Icon className="c-nav-icon" icon={NavIcon} />
              {t('Nav.execution')}
            </NavLink>
          </li>
          <li className="c-nav-item">
            <NavLink
              to="/nodes"
              className="c-nav-link"
              activeClassName="is-active"
            >
              <Icon className="c-nav-icon" icon={NavIcon} />
              {t('Nav.nodes')}
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

// translate() provide t() to use translations (ex: locales/en.json)
export default translate()(Sidebar)
