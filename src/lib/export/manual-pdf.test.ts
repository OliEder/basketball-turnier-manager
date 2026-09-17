import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchImagesAsDataUris } from './manual-pdf'

describe('fetchImagesAsDataUris', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    })
  })

  it('fetches every referenced screenshot filename and returns a filename-to-data-URI map', async () => {
    const result = await fetchImagesAsDataUris(['01-teams-leer.png', '02-team-dialog-leer.png'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(Object.keys(result)).toEqual(['01-teams-leer.png', '02-team-dialog-leer.png'])
    expect(result['01-teams-leer.png']).toMatch(/^data:/)
  })
})
