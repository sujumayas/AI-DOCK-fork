# AI Dock LLM Data Models
# Clean data transfer objects for LLM interactions

from typing import Dict, Any, Optional, List
from datetime import datetime


class ChatMessage:
    """
    Represents a single chat message.
    
    This is our internal format - we'll convert to/from provider formats.
    """
    
    def __init__(self, role: str, content: str, name: Optional[str] = None):
        """
        Initialize a chat message.
        
        Args:
            role: 'user', 'assistant', or 'system'
            content: The message content
            name: Optional name for the message sender
        """
        self.role = role
        self.content = content
        self.name = name
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        message = {
            "role": self.role,
            "content": self.content
        }
        if self.name:
            message["name"] = self.name
        return message
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChatMessage':
        """Create ChatMessage from dictionary."""
        return cls(
            role=data["role"],
            content=data["content"],
            name=data.get("name")
        )
    
    def __repr__(self) -> str:
        return f"ChatMessage(role='{self.role}', content='{self.content[:50]}...')"


class ChatRequest:
    """
    Represents a complete chat request to an LLM.
    """
    
    def __init__(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ):
        """
        Initialize a chat request.
        
        Args:
            messages: List of chat messages
            model: Model to use (overrides configuration default)
            temperature: Response randomness (0.0 to 1.0)
            max_tokens: Maximum tokens in response
            **kwargs: Additional provider-specific parameters
        """
        self.messages = messages
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.extra_params = kwargs
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "messages": [msg.to_dict() for msg in self.messages],
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "extra_params": self.extra_params,
            "timestamp": self.timestamp.isoformat()
        }
    
    def get_total_content_length(self) -> int:
        """Get total character count of all messages."""
        return sum(len(msg.content) for msg in self.messages)
    
    def estimate_tokens(self) -> int:
        """Rough token estimation (1 token ≈ 4 characters)."""
        return self.get_total_content_length() // 4
    
    def __repr__(self) -> str:
        return f"ChatRequest(messages={len(self.messages)}, model='{self.model}')"


class ChatResponse:
    """
    Represents a response from an LLM provider.
    
    This is our unified response format regardless of provider.
    """
    
    def __init__(
        self,
        content: str,
        model: str,
        provider: str,
        usage: Optional[Dict[str, int]] = None,
        cost: Optional[float] = None,
        response_time_ms: Optional[int] = None,
        raw_response: Optional[Dict] = None
    ):
        """
        Initialize a chat response.
        
        Args:
            content: The LLM's response text
            model: Model that generated the response
            provider: Provider that was used
            usage: Token usage information (input_tokens, output_tokens, total_tokens)
            cost: Estimated cost of the request
            response_time_ms: Time taken for the request
            raw_response: Original provider response (for debugging)
        """
        self.content = content
        self.model = model
        self.provider = provider
        self.usage = usage or {}
        self.cost = cost
        self.response_time_ms = response_time_ms
        self.raw_response = raw_response
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for API responses."""
        return {
            "content": self.content,
            "model": self.model,
            "provider": self.provider,
            "usage": self.usage,
            "cost": self.cost,
            "response_time_ms": self.response_time_ms,
            "timestamp": self.timestamp.isoformat()
        }
    
    def get_input_tokens(self) -> int:
        """Get input token count."""
        return self.usage.get("input_tokens", 0)
    
    def get_output_tokens(self) -> int:
        """Get output token count."""
        return self.usage.get("output_tokens", 0)
    
    def get_total_tokens(self) -> int:
        """Get total token count."""
        return self.usage.get("total_tokens", 0)
    
    def is_successful(self) -> bool:
        """Check if response indicates success."""
        return bool(self.content and len(self.content) > 0)
    
    def __repr__(self) -> str:
        return f"ChatResponse(provider='{self.provider}', model='{self.model}', tokens={self.get_total_tokens()})"


class StreamingChunk:
    """
    Represents a single chunk in a streaming response.
    """
    
    def __init__(
        self,
        content: str,
        is_final: bool = False,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        chunk_index: int = 0,
        usage: Optional[Dict[str, int]] = None,
        cost: Optional[float] = None,
        response_time_ms: Optional[int] = None
    ):
        """
        Initialize a streaming chunk.
        
        Args:
            content: Chunk content
            is_final: Whether this is the final chunk
            model: Model generating the response
            provider: Provider name
            chunk_index: Index of this chunk in the stream
            usage: Token usage (typically only in final chunk)
            cost: Cost information (typically only in final chunk)
            response_time_ms: Response time (typically only in final chunk)
        """
        self.content = content
        self.is_final = is_final
        self.model = model
        self.provider = provider
        self.chunk_index = chunk_index
        self.usage = usage or {}
        self.cost = cost
        self.response_time_ms = response_time_ms
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for streaming API."""
        return {
            "content": self.content,
            "is_final": self.is_final,
            "model": self.model,
            "provider": self.provider,
            "chunk_index": self.chunk_index,
            "usage": self.usage if self.is_final else None,
            "cost": self.cost if self.is_final else None,
            "response_time_ms": self.response_time_ms if self.is_final else None,
            "timestamp": self.timestamp.isoformat()
        }
    
    def __repr__(self) -> str:
        final_marker = " [FINAL]" if self.is_final else ""
        return f"StreamingChunk(index={self.chunk_index}, content='{self.content[:30]}...'{final_marker})"


# Export all models for easy importing
__all__ = [
    'ChatMessage',
    'ChatRequest', 
    'ChatResponse',
    'StreamingChunk'
]
