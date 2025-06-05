# Backend Tests

This directory contains all tests for the AI Dock backend application.

## Test Structure

```
tests/
├── core/           # Core functionality tests (config, database, security)
├── models/         # Data model tests  
├── schemas/        # Pydantic schema tests
└── integration/    # Integration and end-to-end tests
```

## Current Tests

### Core Tests
- `test_config.py` - Configuration and API key testing
- `test_database.py` - Database connection and table creation
- `test_jwt_tokens.py` - JWT token creation and verification
- `test_password_security.py` - Password hashing and verification

### Integration Tests
- `test_auth_integration.py` - Complete authentication system integration

## Getting Started

### Setup Test Environment
```bash
# Activate virtual environment
source ai_dock_env/bin/activate

# Install testing dependencies (if not already installed)
pip install pytest pytest-asyncio pytest-cov

# Run tests
pytest tests/

# Run tests with coverage
pytest tests/ --cov=app --cov-report=html
```

### Running Tests

#### Run All Tests
```bash
pytest tests/
```

#### Run Specific Test Categories
```bash
# Core functionality tests
pytest tests/core/

# Model tests
pytest tests/models/

# Integration tests
pytest tests/integration/

# Specific test file
pytest tests/core/test_database.py
```

#### Run Tests with Coverage
```bash
# Generate coverage report
pytest tests/ --cov=app --cov-report=html

# View coverage in browser
open htmlcov/index.html
```

## Writing New Tests

### Test File Structure
```python
#!/usr/bin/env python3
"""
Description of what this test module covers.
"""

import sys
import os

# Add the project root to the path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.module_to_test import function_to_test


def test_function_name():
    """Test description."""
    # Arrange
    test_data = "example"
    
    # Act
    result = function_to_test(test_data)
    
    # Assert
    assert result == expected_value
```

### Async Test Example
```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    """Test async functionality."""
    result = await async_function()
    assert result is not None
```

## Test Guidelines

1. **File Naming**: Use `test_module_name.py` format
2. **Function Naming**: Use `test_function_description()` format
3. **Documentation**: Include docstrings explaining what each test does
4. **Organization**: Group related functionality in the same file
5. **Isolation**: Use proper setup/teardown for database tests
6. **Assertions**: Use clear, specific assertions

## Pytest Configuration

Create a `pytest.ini` file in the Back/ directory:

```ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short
asyncio_mode = auto
```

## Common Commands

```bash
# Run all tests
pytest tests/

# Run with verbose output
pytest tests/ -v

# Run specific test
pytest tests/core/test_database.py::test_database_setup

# Run tests matching pattern
pytest tests/ -k "test_password"

# Run tests and show coverage
pytest tests/ --cov=app
```
