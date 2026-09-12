import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamNameDisplay } from './TeamNameDisplay'
import type { Team } from '@/types'

const team: Team = { id: 't1', name: 'Musterstadt Baskets U11', logoUrl: '', color: '#000', contact: '', players: [] }

describe('TeamNameDisplay', () => {
  it('renders the full name, hidden below the md breakpoint and shown at/above it', () => {
    render(<TeamNameDisplay team={team} />)
    const fullName = screen.getByText('Musterstadt Baskets U11')
    expect(fullName).toHaveClass('hidden', 'md:inline')
  })

  it('renders the abbreviation, shown below the md breakpoint and hidden at/above it', () => {
    render(<TeamNameDisplay team={team} />)
    const abbreviation = screen.getByText('MUS1')
    expect(abbreviation).toHaveClass('md:hidden')
  })

  it('sets the full name as the title attribute on the wrapping element for both cases', () => {
    render(<TeamNameDisplay team={team} />)
    expect(screen.getByText('Musterstadt Baskets U11').closest('[title]')).toHaveAttribute('title', 'Musterstadt Baskets U11')
  })

  it('renders the team logo when logoUrl is set', () => {
    const teamWithLogo: Team = { ...team, logoUrl: 'https://example.com/logo.png' }
    render(<TeamNameDisplay team={teamWithLogo} />)
    const logo = screen.getByRole('img', { name: 'Musterstadt Baskets U11' })
    expect(logo).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('renders no image when logoUrl is empty', () => {
    render(<TeamNameDisplay team={team} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
