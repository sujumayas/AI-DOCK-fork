"""
Middleware package for AI Dock application.

This package contains security and utility middleware that automatically
protects our application from common attacks and improves performance.

Middleware in FastAPI works like "layers" that wrap around your endpoints:
Request → Security → Rate Limiting → Your Endpoint → Rate Limiting → Security → Response

This ensures every request is automatically secured without having to
remember to add security to each individual endpoint.
"""
