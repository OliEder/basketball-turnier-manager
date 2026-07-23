import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TeamForm from './TeamForm'

describe('TeamForm', () => {
  it('renders all fields', () => {
    render(<TeamForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/logo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/farbe/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kontakt/i)).toBeInTheDocument()
  })

  it('calls onSubmit with team data', () => {
    const onSubmit = vi.fn()
    render(<TeamForm onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Fibalon Baskets' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fibalon Baskets' })
    )
  })
})
