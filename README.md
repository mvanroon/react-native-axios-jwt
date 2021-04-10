# react-native-axios-jwt

Store, clear, transmit and automatically refresh JWT authentication tokens in a React Native environment.

## Installation

### 1. Install async-storage

#### Install package

With npm:

```bash
npm install @react-native-async-storage/async-storage
```

With Yarn:

```bash
yarn add @react-native-async-storage/async-storage
```

With Expo CLI:

```bash
expo install @react-native-async-storage/async-storage
```

#### Link Android & iOS packages

- **React Native 0.60+**

```bash
npx pod-install
```

- **React Native <= 0.59**

```bash
react-native link @react-native-async-storage/async-storage
```

Please follow the [async-storage installation instructions](https://react-native-async-storage.github.io/async-storage/docs/install/) if you encounter any problems while installing async-storage

### 2. Install this library

With npm:

```bash
npm install react-native-axios-jwt
```

With Yarn:

```bash
yarn add react-native-axios-jwt
```

## What does it do?

Applies a request interceptor to your axios instance.

The interceptor automatically adds an access token header (default: `Authorization`) to all requests.
It stores `accessToken` and `refreshToken` in `AsyncStorage` and reads them when needed.

It parses the expiration time of your access token and checks to see if it is expired before every request. If it has expired, a request to
refresh and store a new access token is automatically performed before the request proceeds.

## How do I use it?

1. Create an axios instance
2. Define a token refresh function
3. Configure the interceptor
4. Store tokens on login with `setAuthTokens()`
5. Clear tokens on logout with `clearAuthTokens()`

### Applying the interceptor

```typescript
// api.ts

import { IAuthTokens, TokenRefreshRequest, applyAuthTokenInterceptor } from 'axios-jwt'
import axios from 'axios'

const BASE_URL = 'https://api.example.com'

// 1. Create an axios instance that you wish to apply the interceptor to
export const apiClient = axios.create({ baseURL: BASE_URL })

// 2. Define token refresh function.
const requestRefresh: TokenRefreshRequest = async (refreshToken: string): Promise<string> => {

  // Important! Do NOT use the axios instance that you supplied to applyAuthTokenInterceptor (in our case 'apiClient')
  // because this will result in an infinite loop when trying to refresh the token.
  // Use the global axios client or a different instance
  const response = await axios.post(`${BASE_URL}/auth/refresh_token`, { token: refreshToken })

  return response.data.access_token
}

// 3. Add interceptor to your axios instance
applyAuthTokenInterceptor(apiClient, { requestRefresh })
```

### Login/logout

```typescript
// login.ts

import { isLoggedIn, setAuthTokens, clearAuthTokens, getAccessToken, getRefreshToken } from 'axios-jwt'
import { apiClient } from '../apiClient'

// 4. Post email and password and get tokens in return. Call setAuthTokens with the result.
const login = async (params: ILoginRequest) => {
  const response = await apiClient.post('/auth/login', params)

  // save tokens to storage
  await setAuthTokens({
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token
  })
}

// 5. Clear the auth tokens from AsyncStorage
const logout = () => clearAuthTokens()

// Check if refresh token exists
if (isLoggedIn()) {
  // assume we are logged in because we have a refresh token
}

// Get access to tokens
const accessToken = getAccessToken().then(accessToken => console.log(accessToken))
const refreshToken = getRefreshToken().then(refreshToken => console.log(refreshToken))
```

## Configuration

```typescript
applyAuthTokenInterceptor(apiClient, {
  requestRefresh,  // async function that takes a refreshToken and returns a promise the resolves in a fresh accessToken
  header = "Authorization",  // header name
  headerPrefix = "Bearer ",  // header value prefix
})
```

## Caveats

- Your backend should allow a few seconds of leeway between when the token expires and when it actually becomes unusable.

## Non-TypeScript implementation

```javascript
import { applyAuthTokenInterceptor } from 'react-native-axios-jwt';
import axios from 'axios';

const BASE_URL = 'https://api.example.com'

// 1. Create an axios instance that you wish to apply the interceptor to
const apiClient = axios.create({ baseURL: BASE_URL })

// 2. Define token refresh function.
const requestRefresh = async (refresh) => {
    // Notice that this is the global axios instance, not the apiClient!
    const response = await axios.post(`${BASE_URL}/auth/refresh_token`, { refresh })

    return response.data.access_token
};

// 3. Apply interceptor
applyAuthTokenInterceptor(apiClient, { requestRefresh });  // Notice that this uses the apiClient instance.

// 4. Logging in
const login = async (params) => {
  const response = await apiClient.post('/auth/login', params)

  // save tokens to storage
  await setAuthTokens({
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token
  })
}

// 5. Logging out
const logout = async () => await clearAuthTokens()

// Now just make all requests using your apiClient instance
apiClient.get('/api/endpoint/that/requires/login').then(response => { })

```
