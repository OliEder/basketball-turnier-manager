import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScheduleRequired } from './ScheduleRequired'

describe('ScheduleRequired', () => {
  it('erklärt, dass zuerst ein Zeitplan nötig ist, und verlinkt zur Konfiguration', () => {
    render(
      <MemoryRouter>
        <ScheduleRequired />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Bitte zuerst einen Zeitplan generieren/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Konfiguration' })).toHaveAttribute('href', '/config')
  })

  it('akzeptiert einen abweichenden Seitenverweis im Text', () => {
    render(
      <MemoryRouter>
        <ScheduleRequired page="Zeitplan" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Seite „Zeitplan“/)).toBeInTheDocument()
  })
})
