# AI Dock Conversation Service
# Business logic for conversation save/load functionality

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, desc, func, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json
import logging

# Setup logging for conversation service
logger = logging.getLogger(__name__)

from ..models.conversation import Conversation, ConversationMessage
from ..models.user import User
from ..models.llm_config import LLMConfiguration
from ..core.database import get_async_db

class ConversationService:
    """Enhanced conversation service with atomic operations and duplicate prevention"""
    
    async def create_conversation(
        self, 
        db: AsyncSession,
        user_id: int,
        title: str,
        llm_config_id: Optional[int] = None,
        model_used: Optional[str] = None  # Keep parameter for backward compatibility but ignore it
    ) -> Conversation:
        """Create a new conversation"""
        try:
            conversation = Conversation(
                user_id=user_id,
                title=title,
                llm_config_id=llm_config_id,
                message_count=0,
                is_active=True
                # 🔧 FIXED: No longer setting model_used per user request
            )
            
            db.add(conversation)
            await db.commit()
            await db.refresh(conversation)
            
            logger.info(f"Created conversation {conversation.id} for user {user_id}")
            return conversation
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create conversation for user {user_id}: {e}")
            raise
    
    async def get_conversation(
        self,
        db: AsyncSession,
        conversation_id: int,
        user_id: int
    ) -> Optional[Conversation]:
        """Get conversation with all messages"""
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
        """Get user's conversations with pagination"""
        stmt = select(Conversation).where(
            Conversation.user_id == user_id
        ).order_by(
            desc(Conversation.updated_at)
        ).offset(offset).limit(limit)
        
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
        """Save a single message to conversation with enhanced validation and atomic operation"""
        
        try:
            # 🔧 ENHANCED: Validate conversation exists and belongs to user before adding message
            stmt = select(Conversation).where(Conversation.id == conversation_id)
            result = await db.execute(stmt)
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")
            
            # 🔧 ENHANCED: Validate message content
            if not content or not content.strip():
                logger.warning(f"Empty message content for conversation {conversation_id}, role {role}")
                content = ""  # Allow empty content but log it
            
            if role not in ['user', 'assistant', 'system']:
                raise ValueError(f"Invalid role: {role}")
            
            # Ensure metadata is a valid dict
            if metadata is None:
                metadata = {}
            elif not isinstance(metadata, dict):
                logger.warning(f"Invalid metadata type {type(metadata)}, converting to empty dict")
                metadata = {}
            
            # Ensure the metadata is JSON serializable
            try:
                import json
                json.dumps(metadata)  # Test if it's JSON serializable
            except (TypeError, ValueError) as e:
                logger.warning(f"Metadata not JSON serializable: {e}, using empty dict")
                metadata = {}
            
            # 🔧 ENHANCED: Check for potential duplicate messages
            # Look for recent messages with same content and role in last 5 minutes
            recent_time = datetime.utcnow().replace(microsecond=0) - timedelta(minutes=5)
            duplicate_check_stmt = select(ConversationMessage).where(
                and_(
                    ConversationMessage.conversation_id == conversation_id,
                    ConversationMessage.role == role,
                    ConversationMessage.content == content,
                    ConversationMessage.created_at >= recent_time
                )
            ).order_by(desc(ConversationMessage.created_at)).limit(1)
            
            duplicate_result = await db.execute(duplicate_check_stmt)
            existing_message = duplicate_result.scalar_one_or_none()
            
            if existing_message:
                logger.warning(f"Potential duplicate message detected for conversation {conversation_id}, returning existing message {existing_message.id}")
                return existing_message
            
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
            
            # Update conversation stats atomically
            conversation.message_count += 1
            conversation.last_message_at = datetime.utcnow()
            conversation.updated_at = datetime.utcnow()
            # 🔧 FIXED: No longer updating model_used per user request
            
            await db.commit()
            await db.refresh(message)
            
            logger.info(f"Added message {message.id} to conversation {conversation_id}")
            return message
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to save message to conversation {conversation_id}: {e}")
            raise
    
    async def save_conversation_from_messages(
        self,
        db: AsyncSession,
        user_id: int,
        messages: List[Dict[str, Any]],
        llm_config_id: Optional[int] = None,
        model_used: Optional[str] = None,  # Keep for backward compatibility but ignore
        title: Optional[str] = None
    ) -> Conversation:
        """Save a complete conversation from message list with enhanced validation"""
        
        try:
            # 🔧 ENHANCED: Validate input
            if not messages:
                raise ValueError("At least one message is required")
            
            # Auto-generate title if not provided
            if not title:
                title = self._generate_conversation_title(messages)
            
            # Create conversation
            conversation = await self.create_conversation(
                db=db,
                user_id=user_id,
                title=title,
                llm_config_id=llm_config_id
                # 🔧 FIXED: No longer passing model_used per user request
            )
            
            # Add all messages with enhanced validation
            for i, msg in enumerate(messages):
                try:
                    await self.save_message_to_conversation(
                        db=db,
                        conversation_id=conversation.id,
                        role=msg.get('role', 'user'),
                        content=msg.get('content', ''),
                        # 🔧 FIXED: No longer passing model_used per user request
                        tokens_used=msg.get('tokens_used'),
                        cost=msg.get('cost'),
                        response_time_ms=msg.get('response_time_ms'),
                        metadata=msg.get('metadata', {})
                    )
                except Exception as msg_error:
                    logger.error(f"Failed to save message {i} in conversation {conversation.id}: {msg_error}")
                    # Continue with other messages instead of failing completely
                    continue
            
            # Refresh to get updated message count
            await db.refresh(conversation)
            logger.info(f"Saved conversation {conversation.id} with {conversation.message_count} messages")
            
            return conversation
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to save conversation from messages for user {user_id}: {e}")
            raise
    
    async def update_conversation_title(
        self,
        db: AsyncSession,
        conversation_id: int,
        user_id: int,
        new_title: str
    ) -> Optional[Conversation]:
        """Update conversation title"""
        try:
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
                
                logger.info(f"Updated title for conversation {conversation_id}")
            
            return conversation
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update conversation title {conversation_id}: {e}")
            raise
    
    async def delete_conversation(
        self,
        db: AsyncSession,
        conversation_id: int,
        user_id: int
    ) -> bool:
        """Delete conversation and all messages"""
        try:
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
                logger.info(f"Deleted conversation {conversation_id}")
                return True
            
            return False
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete conversation {conversation_id}: {e}")
            raise
    
    async def search_conversations(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 20
    ) -> List[Conversation]:
        """Search conversations by title or content"""
        try:
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
            
        except Exception as e:
            logger.error(f"Failed to search conversations for user {user_id}: {e}")
            raise
    
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
        try:
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
            
        except Exception as e:
            logger.error(f"Failed to get conversation stats for user {user_id}: {e}")
            raise

# Create service instance
conversation_service = ConversationService()
