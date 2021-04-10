import { STORAGE_KEY, setAccessToken } from '../src'

describe('setAccessToken', () => {
  it('throws an error if there are no tokens stored', async () => {
    // GIVEN
    // localStorage is empty
    localStorage.removeItem(STORAGE_KEY)
    // and I have an error handler
    const errorHandler = jest.fn()

    // WHEN
    // I call setAccessToken
    await setAccessToken('accesstoken').catch(errorHandler)

    // THEN
    // I expect the error handler to have been called with the right error
    expect(errorHandler).toHaveBeenCalledWith(
      new Error('Unable to update access token since there are not tokens currently stored')
    )
  })

  it('throws an error if the stored tokens cannot be parsed', async () => {
    // GIVEN
    // localStorage is empty
    localStorage.setItem(STORAGE_KEY, 'totallynotjson')

    // and I have an error handler
    const errorHandler = jest.fn()

    // WHEN
    // I call setAccessToken
    await setAccessToken('accesstoken').catch(errorHandler)

    // THEN
    // I expect the error handler to have been called with the right error
    expect(errorHandler).toHaveBeenCalledWith(new Error('Failed to parse auth tokens: totallynotjson'))
  })

  it('stores the tokens in localstorage', async () => {
    // GIVEN
    // localStorage is empty
    const tokens = { accessToken: 'accesstoken', refreshToken: 'refreshtoken' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

    // WHEN
    // I call setAccessToken
    await setAccessToken('newaccesstoken')

    // THEN
    // I expect the stored access token to have been updated
    const storedTokens = localStorage.getItem(STORAGE_KEY) as string
    expect(JSON.parse(storedTokens)).toEqual({ accessToken: 'newaccesstoken', refreshToken: 'refreshtoken' })
  })
})
