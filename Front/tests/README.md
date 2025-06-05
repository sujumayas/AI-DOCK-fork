# Frontend Tests

This directory contains all tests for the AI Dock frontend application.

## Test Structure

```
tests/
├── components/     # React component tests
├── hooks/         # Custom React hooks tests
├── utils/         # Utility function tests
└── integration/   # E2E and integration tests
```

## Getting Started

### Setup Test Environment
```bash
# Install testing dependencies (if not already installed)
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest jsdom

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

#### Component Tests
```typescript
// tests/components/LoginForm.test.tsx
import { render, screen } from '@testing-library/react'
import { LoginForm } from '../../src/components/LoginForm'

test('renders login form', () => {
  render(<LoginForm />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
})
```

#### Hook Tests
```typescript
// tests/hooks/useAuth.test.ts
import { renderHook } from '@testing-library/react'
import { useAuth } from '../../src/hooks/useAuth'

test('useAuth returns initial state', () => {
  const { result } = renderHook(() => useAuth())
  expect(result.current.user).toBeNull()
  expect(result.current.isLoading).toBe(false)
})
```

#### Utility Tests
```typescript
// tests/utils/validation.test.ts
import { validateEmail } from '../../src/utils/validation'

test('validates email correctly', () => {
  expect(validateEmail('test@example.com')).toBe(true)
  expect(validateEmail('invalid-email')).toBe(false)
})
```

## Test Guidelines

1. **File Naming**: Use `ComponentName.test.tsx` or `functionName.test.ts`
2. **Test Organization**: Group related tests in `describe` blocks
3. **Meaningful Names**: Use descriptive test names that explain the expected behavior
4. **Isolation**: Each test should be independent and not rely on other tests
5. **Mocking**: Mock external dependencies (APIs, modules) to focus on the unit being tested

## Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- LoginForm.test.tsx

# Run tests in specific directory
npm test -- tests/components/

# Run tests with coverage
npm run test:coverage
```
