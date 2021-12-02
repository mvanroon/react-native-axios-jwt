# react-native-axios-jwt

Store, clear, transmit and automatically refresh JWT authentication tokens in a React Native environment.

Looking for a web alternative? Check out [axios-jwt](https://github.com/jetbridge/axios-jwt)

## What does it do?

Applies a request interceptor to your axios instance.

The interceptor automatically adds an access token header (default: `Authorization`) to all requests.
It stores `accessToken` and `refreshToken` in `Keychain/Keystore` and reads them when needed.

It parses the expiration time of your access token and checks to see if it is expired before every request. If it has expired, a request to
refresh and store a new access token is automatically performed before the request proceeds.

## Installation

### 1. Install package

With npm:

```bash
npm install react-native-axios-jwt
```

With Yarn:

```bash
yarn add react-native-axios-jwt
```

### 2. Link Android & iOS packages

- **React Native 0.60+**

```bash
npx pod-install
```

- **React Native <= 0.59**

```bash
react-native link react-native-keychain
```

Please follow the [react-native-keychain installation instructions](https://github.com/oblador/react-native-keychain#installation) if you encounter any problems while installing react-native-keychain.

## How do I use it?

1. Create an axios instance
2. Define a token refresh function
3. Configure the interceptor
4. Store tokens on login with `setAuthTokens()`
5. Clear tokens on logout with `clearAuthTokens()`

### Applying the interceptor

```typescript
// api.ts

import { IAuthTokens, TokenRefreshRequest, applyAuthTokenInterceptor } from 'react-native-axios-jwt'
import axios from 'axios'

const BASE_URL = 'https://api.example.com'

// 1. Create an axios instance that you wish to apply the interceptor to
export const axiosInstance = axios.create({ baseURL: BASE_URL })

// 2. Define token refresh function.
const requestRefresh: TokenRefreshRequest = async (refreshToken: string): Promise<string> => {
  // Important! Do NOT use the axios instance that you supplied to applyAuthTokenInterceptor
  // because this will result in an infinite loop when trying to refresh the token.
  // Use the global axios client or a different instance
  const response = await axios.post(`${BASE_URL}/auth/refresh_token`, { token: refreshToken })

  return response.data.access_token
}

// 3. Add interceptor to your axios instance
applyAuthTokenInterceptor(axiosInstance, { requestRefresh })
```

### Login/logout

```typescript
// login.ts

import { isLoggedIn, setAuthTokens, clearAuthTokens, getAccessToken, getRefreshToken } from 'react-native-axios-jwt'
import { axiosInstance } from './api'

// 4. Log in by POST-ing the email and password and get tokens in return
// and call setAuthTokens with the result.
const login = async (params: ILoginRequest) => {
  const response = await axiosInstance.post('/auth/login', params)

  // save tokens to storage
  await setAuthTokens({
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  })
}

// 5. Log out by clearing the auth tokens from Keychain/Keystore
const logout = () => clearAuthTokens()

// Check if refresh token exists
if (isLoggedIn()) {
  // assume we are logged in because we have a refresh token
}

// Get access to tokens
const accessToken = getAccessToken().then((accessToken) => console.log(accessToken))
const refreshToken = getRefreshToken().then((refreshToken) => console.log(refreshToken))
```

## Configuration

```typescript
applyAuthTokenInterceptor(axiosInstance, {
  requestRefresh, // async function that takes a refreshToken and returns a promise the resolves in a fresh accessToken
  header = 'Authorization', // header name
  headerPrefix = 'Bearer ', // header value prefix
})
```

## Caveats

- Your backend should allow a few seconds of leeway between when the token expires and when it actually becomes unusable.

## Non-TypeScript implementation

```javascript
//api.js

import { applyAuthTokenInterceptor } from 'react-native-axios-jwt'
import axios from 'axios'

const BASE_URL = 'https://api.example.com'

// 1. Create an axios instance that you wish to apply the interceptor to
export const axiosInstance = axios.create({ baseURL: BASE_URL })

// 2. Define token refresh function.
const requestRefresh = async (refresh) => {
  // Notice that this is the global axios instance, not the axiosInstance!
  const response = await axios.post(`${BASE_URL}/auth/refresh_token`, { refresh })

  return response.data.access_token
}

// 3. Apply interceptor
// Notice that this uses the axiosInstance instance.
applyAuthTokenInterceptor(axiosInstance, { requestRefresh })
```

### Login/logout

```javascript
//login.js

import { isLoggedIn, setAuthTokens, clearAuthTokens, getAccessToken, getRefreshToken } from 'react-native-axios-jwt'
import { axiosInstance } from '../api'

// 4. Log in by POST-ing the email and password and get tokens in return
// and call setAuthTokens with the result.
const login = async (params) => {
  const response = await axiosInstance.post('/auth/login', params)

  // save tokens to storage
  await setAuthTokens({
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  })
}

// 5. Log out by clearing the auth tokens from KeycKeychain/Keystorehain
const logout = () => clearAuthTokens()

// Check if refresh token exists
if (isLoggedIn()) {
  // assume we are logged in because we have a refresh token
}

// Get access to tokens
const accessToken = getAccessToken().then((accessToken) => console.log(accessToken))
const refreshToken = getRefreshToken().then((refreshToken) => console.log(refreshToken))

// Now just make all requests using your axiosInstance instance
axiosInstance.get('/api/endpoint/that/requires/login').then((response) => {})
```
