"""
Security Headers Middleware for AI Dock Application

This middleware automatically adds security headers to every HTTP response,
protecting against common web attacks. These headers are essential for
enterprise applications and required by most security audits.

Security Headers Explained:
- Think of them as "rules" we give to browsers about how to handle our app
- They prevent attacks like XSS, clickjacking, and data theft
- Major companies (Google, Microsoft, etc.) require these for any web app
- They work "behind the scenes" - users don't see them but are protected

This middleware follows OWASP (Open Web Application Security Project) 
recommendations and enterprise security standards.
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import logging
from typing import Callable, Awaitable

# Setup logging for security events
logger = logging.getLogger("security")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds comprehensive security headers to all HTTP responses.
    
    This middleware automatically protects your application from:
    - Cross-Site Scripting (XSS) attacks
    - Clickjacking attacks
    - MIME type confusion attacks
    - Information leakage
    - Content injection attacks
    
    How it works:
    1. Every request passes through this middleware first
    2. We let the request continue to your endpoint
    3. When the response comes back, we add security headers
    4. The secured response is sent to the user's browser
    
    Learning Note: This is the "decorator pattern" applied to web requests.
    We're "wrapping" every response with additional security without
    changing the core application logic.
    """
    
    def __init__(self, app: ASGIApp, environment: str = "production"):
        """
        Initialize the security middleware.
        
        Args:
            app: The FastAPI application
            environment: "production", "development", or "testing"
                        (affects header strictness)
        """
        super().__init__(app)
        self.environment = environment
        
        # Log middleware initialization
        logger.info(f"🛡️ Security Headers Middleware initialized for {environment}")
    
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """
        Process each HTTP request and add security headers to the response.
        
        This method is called for EVERY request to your API.
        
        Flow:
        1. Request comes in → this method is called
        2. We call call_next() to let the request continue to your endpoint
        3. Your endpoint processes and returns a response
        4. We add security headers to that response
        5. Secured response is sent back to the user
        
        Args:
            request: The incoming HTTP request
            call_next: Function to continue processing the request
            
        Returns:
            Response with security headers added
        """
        
        # Record start time for performance monitoring
        start_time = time.time()
        
        # Let the request continue to the actual endpoint
        # This is where your /auth/login, /chat/send, etc. endpoints run
        response = await call_next(request)
        
        # Add security headers to the response
        self._add_security_headers(response, request)
        
        # Log security event for monitoring
        process_time = time.time() - start_time
        self._log_security_event(request, response, process_time)
        
        return response
    
    def _add_security_headers(self, response: Response, request: Request) -> None:
        """
        Add comprehensive security headers to the HTTP response.
        
        Each header protects against specific types of attacks.
        These headers are like "instructions" we give to the user's browser
        about how to securely handle our application.
        
        Args:
            response: HTTP response to add headers to
            request: Original HTTP request (for context)
        """
        
        # =================================================================
        # 1. XSS (Cross-Site Scripting) Protection
        # =================================================================
        
        # X-Content-Type-Options: Prevents MIME type confusion attacks
        # Without this, browsers might interpret JSON as HTML and execute scripts
        # Example: Attacker uploads "image.jpg" that's actually JavaScript
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-Frame-Options: Prevents clickjacking attacks
        # Stops attackers from embedding your app in hidden iframes
        # Example: Fake "Click here for free money" button over your "Delete Account" button
        response.headers["X-Frame-Options"] = "DENY"
        
        # X-XSS-Protection: Enables browser's built-in XSS filter
        # Modern browsers use this to detect and block obvious XSS attempts
        # Example: URL like yourapp.com/search?q=<script>alert('hacked')</script>
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # =================================================================
        # 2. Content Security Policy (CSP) - The Big One!
        # =================================================================
        
        # CSP is like a "whitelist" of what resources your app can load
        # It prevents injection of malicious scripts, styles, images, etc.
        # This is the most powerful protection against XSS attacks
        
        if self.environment == "production":
            # Strict CSP for production - maximum security
            csp_policy = (
                "default-src 'self'; "                    # Only load resources from our domain
                "script-src 'self' 'unsafe-inline'; "     # Allow scripts from our domain + inline scripts
                "style-src 'self' 'unsafe-inline'; "      # Allow styles from our domain + inline styles
                "img-src 'self' data: https:; "           # Allow images from our domain, data URLs, and HTTPS
                "font-src 'self' https://fonts.gstatic.com; "  # Allow fonts from our domain and Google Fonts
                "connect-src 'self' https:; "              # Allow API calls to our domain and HTTPS endpoints
                "frame-ancestors 'none'; "                # Don't allow embedding in frames (redundant with X-Frame-Options)
                "base-uri 'self'; "                       # Only allow base URLs from our domain
                "form-action 'self'; "                    # Only allow form submissions to our domain
                "upgrade-insecure-requests"               # Automatically upgrade HTTP to HTTPS
            )
        else:
            # Relaxed CSP for development - easier debugging
            # Special handling for FastAPI docs endpoints
            if request.url.path in ["/docs", "/redoc"] or request.url.path.startswith("/docs/") or request.url.path.startswith("/redoc/"):
                # Very permissive CSP for Swagger UI to load from CDN
                csp_policy = (
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                    "img-src 'self' data: https: http:; "
                    "connect-src 'self' https: http: ws: wss:; "
                    "font-src 'self' https://cdn.jsdelivr.net; "
                    "frame-ancestors 'none'"
                )
            else:
                # Regular development CSP for other endpoints
                csp_policy = (
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Allow inline scripts for debugging
                    "img-src 'self' data: https: http:; "                  # Allow HTTP images in development
                    "connect-src 'self' https: http: ws: wss:; "           # Allow WebSocket connections for hot reload
                    "frame-ancestors 'none'"
                )
        
        response.headers["Content-Security-Policy"] = csp_policy
        
        # =================================================================
        # 3. HTTPS and Transport Security
        # =================================================================
        
        if self.environment == "production":
            # HSTS (HTTP Strict Transport Security): Force HTTPS for future requests
            # Once a browser sees this header, it will ONLY use HTTPS for your domain
            # This prevents downgrade attacks where attackers force HTTP connections
            # max-age=31536000 = 1 year in seconds
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # =================================================================
        # 4. Privacy and Information Leakage Protection
        # =================================================================
        
        # Referrer-Policy: Controls what information is sent in the Referer header
        # "strict-origin-when-cross-origin" means:
        # - Same origin: Send full URL
        # - Cross origin HTTPS→HTTPS: Send only domain
        # - Cross origin HTTPS→HTTP: Send nothing (prevents info leakage)
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy: Controls browser features (camera, microphone, geolocation)
        # For an AI chat app, we disable most features users don't need
        # This prevents malicious scripts from accessing sensitive browser APIs
        response.headers["Permissions-Policy"] = (
            "camera=(), "           # Disable camera access
            "microphone=(), "       # Disable microphone access
            "geolocation=(), "      # Disable location access
            "payment=(), "          # Disable payment APIs
            "usb=(), "              # Disable USB access
            "bluetooth=()"          # Disable Bluetooth access
        )
        
        # =================================================================
        # 5. Cache and Information Disclosure Protection
        # =================================================================
        
        # Cache-Control: Prevent sensitive data from being cached
        # For API responses, we generally don't want browsers caching responses
        # that might contain user-specific or sensitive information
        if request.url.path.startswith("/admin") or request.url.path.startswith("/auth"):
            # Admin and auth endpoints should never be cached
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        # Server: Hide server information to prevent fingerprinting
        # Don't tell attackers what server software we're running
        response.headers["Server"] = "AI-Dock"
        
        # X-Powered-By: Remove if present (some servers add this automatically)
        if "X-Powered-By" in response.headers:
            del response.headers["X-Powered-By"]
        
        # =================================================================
        # 6. AI Dock Specific Security Headers
        # =================================================================
        
        # Custom header to identify our API (useful for monitoring)
        response.headers["X-AI-Dock-Security"] = "enabled"
        
        # Rate limiting information (will be set by rate limiting middleware)
        # We're preparing the header structure here
        if "X-RateLimit-Limit" not in response.headers:
            response.headers["X-RateLimit-Limit"] = "100"  # Default limit
        
    def _log_security_event(self, request: Request, response: Response, process_time: float) -> None:
        """
        Log security-related events for monitoring and incident response.
        
        This helps security teams detect attacks and monitor application health.
        In production, these logs would be sent to a SIEM (Security Information
        and Event Management) system for analysis.
        
        Args:
            request: HTTP request that was processed
            response: HTTP response that was generated
            process_time: Time taken to process the request
        """
        
        # Get client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "Unknown")
        
        # Security event data
        security_event = {
            "timestamp": time.time(),
            "client_ip": client_ip,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "process_time": process_time,
            "user_agent": user_agent,
            "security_headers_applied": True
        }
        
        # Log different levels based on response status
        if response.status_code >= 400:
            # Error responses - might indicate attack attempts
            if response.status_code == 401:
                logger.warning(f"🔐 Authentication failure from {client_ip}: {request.url.path}")
            elif response.status_code == 403:
                logger.warning(f"🚫 Authorization failure from {client_ip}: {request.url.path}")
            elif response.status_code == 429:
                logger.warning(f"⏱️ Rate limit exceeded from {client_ip}: {request.url.path}")
            else:
                logger.warning(f"❌ Error response {response.status_code} from {client_ip}: {request.url.path}")
        
        # Detailed debug logging for development
        if self.environment == "development":
            logger.debug(f"Security event: {security_event}")
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Get the real client IP address, accounting for proxies and load balancers.
        
        In production, requests often pass through multiple servers:
        User → CDN → Load Balancer → Reverse Proxy → Your App
        
        Each server adds headers with the original IP address.
        We check these headers in order of reliability.
        
        Args:
            request: HTTP request to extract IP from
            
        Returns:
            Client IP address as string
        """
        
        # Check common proxy headers in order of preference
        # X-Forwarded-For: Most common proxy header (comma-separated list)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP (original client) from comma-separated list
            return forwarded_for.split(",")[0].strip()
        
        # X-Real-IP: Used by nginx and other reverse proxies
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # CF-Connecting-IP: Used by Cloudflare CDN
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip:
            return cf_ip.strip()
        
        # Fallback to direct connection IP
        return getattr(request.client, "host", "unknown")


class SecurityResponseMiddleware:
    """
    Additional response security middleware for special cases.
    
    This class provides utility methods for adding security headers
    to specific types of responses or in special situations.
    
    Learning Note: Sometimes you need different security headers
    for different types of responses (JSON API vs file downloads).
    This class provides that flexibility.
    """
    
    @staticmethod
    def secure_json_response(data: dict, status_code: int = 200) -> JSONResponse:
        """
        Create a JSON response with extra security headers.
        
        Use this for sensitive API responses that need additional protection.
        
        Args:
            data: Dictionary to return as JSON
            status_code: HTTP status code
            
        Returns:
            JSONResponse with security headers
        """
        response = JSONResponse(content=data, status_code=status_code)
        
        # Add extra security for sensitive JSON responses
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        
        return response
    
    @staticmethod
    def secure_error_response(message: str, status_code: int) -> JSONResponse:
        """
        Create a secure error response that doesn't leak information.
        
        Error responses can accidentally reveal sensitive information.
        This method ensures error responses are secure and don't help attackers.
        
        Args:
            message: Error message to display
            status_code: HTTP status code
            
        Returns:
            Secure error response
        """
        response = JSONResponse(
            content={"error": message, "status": status_code},
            status_code=status_code
        )
        
        # Security headers for error responses
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        
        return response


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def is_admin_endpoint(path: str) -> bool:
    """
    Check if a request path is an admin endpoint.
    
    Admin endpoints need extra security protection.
    
    Args:
        path: Request URL path
        
    Returns:
        True if path is an admin endpoint
    """
    admin_prefixes = ["/admin", "/api/admin"]
    return any(path.startswith(prefix) for prefix in admin_prefixes)


def is_sensitive_endpoint(path: str) -> bool:
    """
    Check if a request path handles sensitive data.
    
    Sensitive endpoints get additional security headers.
    
    Args:
        path: Request URL path
        
    Returns:
        True if path handles sensitive data
    """
    sensitive_prefixes = ["/auth", "/admin", "/chat"]
    return any(path.startswith(prefix) for prefix in sensitive_prefixes)


def get_security_config(environment: str) -> dict:
    """
    Get environment-specific security configuration.
    
    Different environments need different security settings:
    - Production: Maximum security, strict policies
    - Development: Relaxed for easier debugging
    - Testing: Minimal for test performance
    
    Args:
        environment: "production", "development", or "testing"
        
    Returns:
        Dictionary with security configuration
    """
    configs = {
        "production": {
            "strict_csp": True,
            "hsts_enabled": True,
            "security_logging": "detailed",
            "cache_sensitive": False
        },
        "development": {
            "strict_csp": False,
            "hsts_enabled": False,
            "security_logging": "basic",
            "cache_sensitive": False
        },
        "testing": {
            "strict_csp": False,
            "hsts_enabled": False,
            "security_logging": "minimal",
            "cache_sensitive": True
        }
    }
    
    return configs.get(environment, configs["production"])


# =============================================================================
# EXAMPLE USAGE AND TESTING
# =============================================================================

def create_security_test_response() -> dict:
    """
    Create a test response to verify security headers are working.
    
    This function is useful for testing that the middleware is
    correctly adding security headers to responses.
    
    Returns:
        Dictionary with security testing information
    """
    return {
        "message": "Security headers test endpoint",
        "timestamp": time.time(),
        "security_features": [
            "XSS Protection",
            "Clickjacking Prevention",
            "Content Security Policy",
            "MIME Type Protection",
            "Information Disclosure Prevention"
        ],
        "headers_added": [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "X-XSS-Protection",
            "Content-Security-Policy",
            "Referrer-Policy",
            "Permissions-Policy",
            "Cache-Control"
        ]
    }
