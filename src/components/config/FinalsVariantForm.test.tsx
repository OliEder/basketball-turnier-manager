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

  it('disables the dropout-handling select and explains why, since withdrawal always uses walkover for now', () => {
    render(<FinalsVariantForm />)
    const select = screen.getByLabelText('Bei Rückzug in der Endrunde')
    expect(select).toBeDisabled()
    expect(screen.getByText(/immer als Walkover gewertet/)).toBeInTheDocument()
  })

  it('shows a capacity warning when Endrunde 4 would generate many extra games', () => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 8,
        finalsVariant: 'endrunde-4',
        teams: Array.from({ length: 32 }, (_, i) => ({
          id: `t${i}`, name: `T${i}`, logoUrl: '', color: '#000', contact: '', players: [],
          groupId: String.fromCharCode(65 + (i % 8)),
        })),
      },
    })
    render(<FinalsVariantForm />)
    expect(screen.getByText(/zusätzliche Spiele/i)).toBeInTheDocument()
  })

  it('does not show a capacity warning for a small Endrunde 4 setup', () => {
    render(<FinalsVariantForm />)
    expect(screen.queryByText(/zusätzliche Spiele/i)).not.toBeInTheDocument()
  })

  it('offers Endrunde 3 as an option and disables it unless there are exactly 4 groups', () => {
    render(<FinalsVariantForm />)
    // beforeEach sets up groupCount: 2 — Endrunde 3 requires exactly 4 groups
    const endrunde3Option = screen.getByRole('option', { name: /Endrunde 3/ })
    expect(endrunde3Option).toBeDisabled()
    expect(screen.getByText(/Endrunde 3.*genau 4 Gruppen/)).toBeInTheDocument()
  })

  it('lets the organizer select Endrunde 3 once there are exactly 4 groups', () => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 4,
        teams: [
          { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
          { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'C' },
          { id: 't4', name: 'T4', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'D' },
        ],
      },
    })
    render(<FinalsVariantForm />)
    const endrunde3Option = screen.getByRole('option', { name: /Endrunde 3/ })
    expect(endrunde3Option).not.toBeDisabled()

    const select = screen.getByLabelText('Endrunden-Variante')
    fireEvent.change(select, { target: { value: 'endrunde-3' } })
    expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-3')
  })

  it('offers Endrunde 1 as an option and disables it unless the group count is an exact power of 2 up to 32', () => {
    // beforeEach sets up groupCount: 2 -- Endrunde 1 IS usable at groupCount 2, so re-set to 3 to test the disabled case
    useTournamentStore.setState({
      tournament: { ...useTournamentStore.getState().tournament, groupCount: 3 },
    })
    render(<FinalsVariantForm />)
    const endrunde1Options = screen.getAllByRole('option', { name: /Endrunde 1/ })
    expect(endrunde1Options[endrunde1Options.length - 1]).toBeDisabled()
    expect(screen.getByText(/Endrunde 1.*2, 4, 8, 16 oder 32 Gruppen/)).toBeInTheDocument()
  })

  it('lets the organizer select Endrunde 1 when the group count is a supported power of 2', () => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 8,
        teams: Array.from({ length: 16 }, (_, i) => ({
          id: `t${i}`, name: `T${i}`, logoUrl: '', color: '#000', contact: '', players: [],
          groupId: String.fromCharCode(65 + (i % 8)),
        })),
      },
    })
    render(<FinalsVariantForm />)
    const endrunde1Options = screen.getAllByRole('option', { name: /Endrunde 1/ })
    expect(endrunde1Options[endrunde1Options.length - 1]).not.toBeDisabled()

    const select = screen.getByLabelText('Endrunden-Variante')
    fireEvent.change(select, { target: { value: 'endrunde-1' } })
    expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-1')
  })
})
