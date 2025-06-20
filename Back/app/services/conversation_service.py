# AI Dock Conversation Service
# Business logic for conversation save/load functionality

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, desc, func, and_
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import logging

# Setup logging for conversation service
logger = logging.getLogger(__name__)

from ..models.conversation import Conversation, ConversationMessage
from ..models.user import User
from ..models.llm_config import LLMConfiguration
from ..core.database import get_async_db

class ConversationService:
    """
    Service for managing conversation operations
    Handles CRUD operations, auto-save logic, and conversation management
    """
    
    async def create_conversation(
        self, 
        db: AsyncSession,
        user_id: int,
        title: str,
        llm_config_id: Optional[int] = None,
        model_used: Optional[str] = None
    ) -> Conversation:
        """Create a new conversation"""
        conversation = Conversation(
            user_id=user_id,
            title=title,
            llm_config_id=llm_config_id,
            model_used=model_used
        )
        
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        
        return conversation
    
    async def get_conversation(
        self,
        db: AsyncSession,
        conversation_id: int,
        user_id: int
    ) -> Optional[Conversation]:
        """Get conversation with messages by ID (user-scoped)"""
        stmt = select(Conversation).options(
            selectinload(Conversation.messages)
        ).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            )
        )
        
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_user_conversations(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[Conversation]:
        """Get user's conversations (paginated, newest first)"""
        stmt = select(Conversation).where(
            Conversation.user_id == user_id
        ).order_by(
            desc(Conversation.updated_at)
        ).limit(limit).offset(offset)
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def save_message_to_conversation(
        self,
        db: AsyncSession,
        conversation_id: int,
        role: str,  # 'user' or 'assistant'
        content: str,
        model_used: Optional[str] = None,
        tokens_used: Optional[int] = None,
        cost: Optional[str] = None,
        response_time_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ConversationMessage:
        """Add a message to existing conversation"""
        # Ensure metadata is always a proper dictionary for JSON serialization
        if metadata is None:
            metadata = {}
        elif not isinstance(metadata, dict):
            # Log warning for debugging but don't crash
            logger.warning(f"Invalid metadata type {type(metadata)}, converting to empty dict")
            metadata = {}
        
        # Ensure the metadata is JSON serializable
        try:
            import json
            json.dumps(metadata)  # Test if it's JSON serializable
        except (TypeError, ValueError) as e:
            logger.warning(f"Metadata not JSON serializable: {e}, using empty dict")
            metadata = {}
        
        # Create message with properly validated metadata
        message = ConversationMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            model_used=model_used,
            tokens_used=tokens_used,
            cost=cost,
            response_time_ms=response_time_ms,
            message_metadata=metadata  # Use the correct field name
        )
        
        db.add(message)
        
        # Update conversation stats
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(stmt)
        conversation = result.scalar_one_or_none()
        
        if conversation:
            conversation.message_count += 1
            conversation.last_message_at = datetime.utcnow()
            conversation.updated_at = datetime.utcnow()
            if model_used:
                conversation.model_used = model_used
        
        await db.commit()
        await db.refresh(message)
        
        return message
    
    async def save_conversation_from_messages(
        self,
        db: AsyncSession,
        user_id: int,
        messages: List[Dict[str, Any]],
        llm_config_id: Optional[int] = None,
        model_used: Optional[str] = None,
        title: Optional[str] = None
    ) -> Conversation:
        """Save a complete conversation from message list"""
        
        # Auto-generate title if not provided
        if not title:
            title = self._generate_conversation_title(messages)
        
        # Create conversation
        conversation = await self.create_conversation(
            db=db,
            user_id=user_id,
            title=title,
            llm_config_id=llm_config_id,
            model_used=model_used
        )
        
        # Add all messages
        for msg in messages:
            await self.save_message_to_conversation(
                db=db,
                conversation_id=conversation.id,
                role=msg.get('role', 'user'),
                content=msg.get('content', ''),
                model_used=msg.get('model_used', model_used),
                tokens_used=msg.get('tokens_used'),
                cost=msg.get('cost'),
                response_time_ms=msg.get('response_time_ms'),
                metadata=msg.get('metadata')
            )
        
        return conversation
    
    async def update_conversation_title(
        self,
        db: AsyncSession,
        conversation_id: int,
        user_id: int,
        new_title: str
    ) -> Optional[Conversation]:
        """Update conversation title"""
        stmt = select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            )
        )
        
        result = await db.execute(stmt)
        conversation = result.scalar_one_or_none()
        
        if conversation:
            conversation.title = new_title
            conversation.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(conversation)
        
        return conversation
    
    async def delete_conversation(
        self,
        db: AsyncSession,
        conversation_id: int,
        user_id: int
    ) -> bool:
        """Delete conversation and all messages"""
        stmt = select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            )
        )
        
        result = await db.execute(stmt)
        conversation = result.scalar_one_or_none()
        
        if conversation:
            await db.delete(conversation)
            await db.commit()
            return True
        
        return False
    
    async def search_conversations(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 20
    ) -> List[Conversation]:
        """Search conversations by title or content"""
        # Simple title search (can be enhanced with full-text search)
        stmt = select(Conversation).where(
            and_(
                Conversation.user_id == user_id,
                Conversation.title.ilike(f'%{query}%')
            )
        ).order_by(
            desc(Conversation.updated_at)
        ).limit(limit)
        
        result = await db.execute(stmt)
        return result.scalars().all()
    
    def _generate_conversation_title(self, messages: List[Dict[str, Any]]) -> str:
        """Auto-generate conversation title from first user message"""
        for msg in messages:
            if msg.get('role') == 'user' and msg.get('content'):
                content = msg['content'].strip()
                if content:
                    # Take first 50 chars and clean up
                    title = content[:50]
                    if len(content) > 50:
                        title += "..."
                    return title
        
        # Fallback to timestamp-based title
        return f"Conversation {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    async def get_conversation_stats(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """Get user's conversation statistics"""
        # Total conversations
        total_stmt = select(func.count(Conversation.id)).where(
            Conversation.user_id == user_id
        )
        total_result = await db.execute(total_stmt)
        total_conversations = total_result.scalar()
        
        # Total messages across all conversations
        msg_stmt = select(func.count(ConversationMessage.id)).join(
            Conversation
        ).where(
            Conversation.user_id == user_id
        )
        msg_result = await db.execute(msg_stmt)
        total_messages = msg_result.scalar()
        
        return {
            "total_conversations": total_conversations or 0,
            "total_messages": total_messages or 0
        }

# Create service instance
conversation_service = ConversationService()
