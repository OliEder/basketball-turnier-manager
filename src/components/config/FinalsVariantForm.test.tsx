import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FinalsVariantForm from './FinalsVariantForm'
import { useTournamentStore } from '@/store/tournament-store'

describe('FinalsVariantForm', () => {
  beforeEach(() => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 2,
        teams: [
          { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
        ],
      },
    })
  })

  it('lets the organizer select Endrunde 4 as the finals variant', () => {
    render(<FinalsVariantForm />)
    const select = screen.getByLabelText('Endrunden-Variante')
    fireEvent.change(select, { target: { value: 'endrunde-4' } })
    expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-4')
  })

  it('shows an uneven-groups warning when group sizes differ', () => {
    render(<FinalsVariantForm />)
    expect(screen.getByText(/unterschiedlich groß/i)).toBeInTheDocument()
  })

  it('does not show the uneven-groups warning when group sizes match', () => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 2,
        teams: [
          { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
          { id: 't4', name: 'T4', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
        ],
      },
    })
    render(<FinalsVariantForm />)
    expect(screen.queryByText(/unterschiedlich groß/i)).not.toBeInTheDocument()
  })

  it('lets the organizer choose the dropout-handling strategy', () => {
    render(<FinalsVariantForm />)
    const select = screen.getByLabelText('Bei Rückzug in der Endrunde')
    fireEvent.change(select, { target: { value: 'walkover' } })
    expect(useTournamentStore.getState().tournament.dropoutHandling).toBe('walkover')
  })
})
