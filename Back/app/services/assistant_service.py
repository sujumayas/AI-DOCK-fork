# AI Dock Assistant Service
# Business logic for custom AI assistant management and operations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, desc, func, and_, or_
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import json
import logging

# Setup logging for assistant service
logger = logging.getLogger(__name__)

from ..models.assistant import Assistant
from ..models.chat_conversation import ChatConversation
from ..models.conversation import Conversation
from ..models.user import User
from ..schemas.assistant import (
    AssistantCreate, 
    AssistantUpdate, 
    AssistantResponse,
    AssistantSummary,
    AssistantListRequest,
    AssistantConversationCreate
)

class AssistantService:
    """
    Service for managing custom AI assistant operations.
    
    🎓 LEARNING: Service Layer Architecture
    =====================================
    The service layer contains business logic and sits between:
    - API endpoints (receive HTTP requests)
    - Database models (store data)
    
    Services handle:
    - Complex business rules and validation
    - Data transformations
    - Cross-table operations
    - Authorization checks
    - Error handling and logging
    
    This keeps business logic organized and reusable across different parts of the app.
    
    Key Responsibilities:
    - Create, read, update, delete assistants
    - Validate user ownership and permissions
    - Manage assistant-conversation relationships
    - Provide search and filtering capabilities
    - Handle assistant cloning and sharing
    """
    
    # =============================================================================
    # ASSISTANT CRUD OPERATIONS
    # =============================================================================
    
    async def create_assistant(
        self, 
        db: AsyncSession,
        user_id: int,
        assistant_data: AssistantCreate
    ) -> Assistant:
        """
        Create a new custom assistant for a user.
        
        🎓 LEARNING: Creation Pattern
        ===========================
        When creating database records:
        1. Validate input data (schemas handle basic validation)
        2. Check business rules (quotas, permissions)
        3. Create the model instance
        4. Save to database
        5. Return the created object
        
        Args:
            db: Async database session
            user_id: ID of the user creating the assistant
            assistant_data: Validated assistant creation data
            
        Returns:
            Created Assistant instance
            
        Raises:
            ValueError: If user reaches assistant limit or validation fails
            PermissionError: If user doesn't have permission to create assistants
        """
        try:
            # Check if user has reached assistant limit
            user_assistant_count = await self._get_user_assistant_count(db, user_id)
            max_assistants = 50  # Could be configurable per user role
            
            if user_assistant_count >= max_assistants:
                raise ValueError(f"User has reached maximum assistant limit ({max_assistants})")
            
            # Check for duplicate names within user's assistants
            existing_assistant = await self._get_user_assistant_by_name(
                db, user_id, assistant_data.name
            )
            if existing_assistant:
                raise ValueError(f"Assistant with name '{assistant_data.name}' already exists")
            
            # Create the assistant instance
            assistant = Assistant(
                name=assistant_data.name.strip(),
                description=assistant_data.description.strip() if assistant_data.description else None,
                system_prompt=assistant_data.system_prompt.strip(),
                model_preferences=assistant_data.model_preferences or {},
                user_id=user_id,
                is_active=True
            )
            
            # Validate the assistant data
            if not assistant.is_valid():
                raise ValueError("Assistant data validation failed")
            
            # Save to database
            db.add(assistant)
            await db.commit()
            await db.refresh(assistant)
            
            logger.info(f"Created assistant '{assistant.name}' (ID: {assistant.id}) for user {user_id}")
            return assistant
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create assistant for user {user_id}: {str(e)}")
            raise
    
    async def get_assistant(
        self,
        db: AsyncSession,
        assistant_id: int,
        user_id: int
    ) -> Optional[Assistant]:
        """
        Get an assistant by ID with ownership validation.
        
        🎓 LEARNING: Security by Design with Computed Fields
        ===================================================
        Always validate ownership when retrieving user-owned resources.
        This prevents users from accessing assistants they don't own.
        
        We also compute conversation count to avoid lazy loading issues.
        
        Args:
            db: Async database session
            assistant_id: ID of the assistant to retrieve
            user_id: ID of the user requesting the assistant
            
        Returns:
            Assistant instance if found and owned by user, None otherwise
        """
        try:
            # Create subquery for conversation count
            conversation_count_subquery = (
                select(func.count(ChatConversation.id))
                .where(ChatConversation.assistant_id == Assistant.id)
                .label("conversation_count")
            )
            
            stmt = select(
                Assistant,
                conversation_count_subquery
            ).where(
                and_(
                    Assistant.id == assistant_id,
                    Assistant.user_id == user_id  # Ownership validation
                )
            )
            
            result = await db.execute(stmt)
            row = result.first()
            
            if row:
                assistant = row[0]  # Assistant object
                conversation_count = row[1] or 0  # Conversation count
                
                # Attach conversation count as an attribute to avoid lazy loading
                assistant._conversation_count = conversation_count
                
                logger.debug(f"Retrieved assistant {assistant_id} for user {user_id}")
                return assistant
            else:
                logger.warning(f"Assistant {assistant_id} not found or not owned by user {user_id}")
                return None
            
        except Exception as e:
            logger.error(f"Failed to get assistant {assistant_id} for user {user_id}: {str(e)}")
            raise
    
    async def update_assistant(
        self,
        db: AsyncSession,
        assistant_id: int,
        user_id: int,
        update_data: AssistantUpdate
    ) -> Optional[Assistant]:
        """
        Update an existing assistant with ownership validation.
        
        🎓 LEARNING: Partial Updates
        ===========================
        Update operations should:
        1. Only modify fields that are provided (partial updates)
        2. Preserve existing data for non-provided fields
        3. Validate ownership before allowing changes
        4. Update timestamps automatically
        
        Args:
            db: Async database session
            assistant_id: ID of the assistant to update
            user_id: ID of the user requesting the update
            update_data: Fields to update (only non-None fields are updated)
            
        Returns:
            Updated Assistant instance or None if not found/owned
            
        Raises:
            ValueError: If update data is invalid or name conflicts
        """
        try:
            # Get the existing assistant with ownership validation
            assistant = await self.get_assistant(db, assistant_id, user_id)
            if not assistant:
                return None
            
            # Track what fields are being updated for logging
            updated_fields = []
            
            # Update fields only if provided in update_data
            if update_data.name is not None:
                # Check for name conflicts with other user assistants
                if update_data.name.strip() != assistant.name:
                    existing = await self._get_user_assistant_by_name(
                        db, user_id, update_data.name.strip()
                    )
                    if existing and existing.id != assistant_id:
                        raise ValueError(f"Assistant with name '{update_data.name}' already exists")
                
                assistant.name = update_data.name.strip()
                updated_fields.append("name")
            
            if update_data.description is not None:
                assistant.description = update_data.description.strip() if update_data.description else None
                updated_fields.append("description")
            
            if update_data.system_prompt is not None:
                assistant.update_system_prompt(update_data.system_prompt.strip())
                updated_fields.append("system_prompt")
            
            if update_data.model_preferences is not None:
                assistant.model_preferences = update_data.model_preferences
                updated_fields.append("model_preferences")
            
            if update_data.is_active is not None:
                if update_data.is_active != assistant.is_active:
                    if update_data.is_active:
                        assistant.activate()
                    else:
                        assistant.deactivate()
                    updated_fields.append("is_active")
            
            # Validate the updated assistant
            if not assistant.is_valid():
                raise ValueError("Updated assistant data validation failed")
            
            # Save changes
            await db.commit()
            await db.refresh(assistant)
            
            logger.info(f"Updated assistant {assistant_id} fields: {', '.join(updated_fields)}")
            return assistant
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to update assistant {assistant_id} for user {user_id}: {str(e)}")
            raise
    
    async def delete_assistant(
        self,
        db: AsyncSession,
        assistant_id: int,
        user_id: int
    ) -> bool:
        """
        Delete an assistant and all associated conversations.
        
        🎓 LEARNING: Cascade Deletes and Async SQLAlchemy Patterns
        =========================================================
        When deleting assistants, we need to handle:
        - Associated conversations (delete or unlink)
        - Chat conversations (delete or convert to general)
        - Usage logs (keep for analytics but mark assistant as deleted)
        
        🔧 CRITICAL ASYNC PATTERNS:
        - Use `db.delete(instance)` WITHOUT await (synchronous)
        - Use `await db.commit()` to actually perform the deletion
        - Don't access lazy-loaded relationships in async context
        - Use explicit queries for counts instead of len(relationship)
        
        The model relationships use cascade="all, delete-orphan" so SQLAlchemy
        will automatically handle the deletions.
        
        Args:
            db: Async database session
            assistant_id: ID of the assistant to delete
            user_id: ID of the user requesting deletion
            
        Returns:
            True if deleted successfully, False if not found/owned
        """
        try:
            # Get the assistant with ownership validation
            assistant = await self.get_assistant(db, assistant_id, user_id)
            if not assistant:
                return False
            
            # Log the deletion with context - use SQL queries to avoid lazy loading issues
            # Get conversation counts without accessing potentially lazy-loaded relationships
            conversation_count_stmt = select(func.count(Conversation.id)).where(
                Conversation.assistant_id == assistant_id
            )
            conversation_count_result = await db.execute(conversation_count_stmt)
            conversation_count = conversation_count_result.scalar() or 0
            
            chat_conversation_count_stmt = select(func.count(ChatConversation.id)).where(
                ChatConversation.assistant_id == assistant_id
            )
            chat_conversation_count_result = await db.execute(chat_conversation_count_stmt)
            chat_conversation_count = chat_conversation_count_result.scalar() or 0
            
            logger.info(
                f"Deleting assistant '{assistant.name}' (ID: {assistant_id}) with "
                f"{conversation_count} conversations and {chat_conversation_count} chat conversations"
            )
            
            # Delete the assistant (cascade will handle related records)
            # 🔧 CRITICAL FIX: In async SQLAlchemy, db.delete() IS async and must be awaited!
            await db.delete(assistant)
            await db.commit()
            
            logger.info(f"Successfully deleted assistant {assistant_id}")
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete assistant {assistant_id} for user {user_id}: {str(e)}")
            raise
    
    # =============================================================================
    # ASSISTANT LISTING AND SEARCH
    # =============================================================================
    
    async def get_user_assistants(
        self,
        db: AsyncSession,
        user_id: int,
        request: Optional[AssistantListRequest] = None
    ) -> Tuple[List[Assistant], int]:
        """
        Get assistants for a user with filtering, search, and pagination.
        
        🎓 LEARNING: Complex Queries with Conversation Counts
        ===================================================
        Production applications need sophisticated querying:
        - Pagination (don't load all data at once)
        - Filtering (by status, date ranges, etc.)
        - Search (fuzzy matching on text fields)
        - Sorting (by different criteria)
        - Computed fields (like conversation counts) without lazy loading
        
        This method demonstrates building dynamic queries based on parameters
        and avoiding the N+1 problem by computing conversation counts in SQL.
        
        Args:
            db: Async database session
            user_id: ID of the user whose assistants to retrieve
            request: Optional filtering and pagination parameters
            
        Returns:
            Tuple of (assistants_list, total_count)
        """
        try:
            if request is None:
                request = AssistantListRequest()
            
            # Create a subquery for conversation counts to avoid lazy loading
            conversation_count_subquery = (
                select(func.count(ChatConversation.id))
                .where(ChatConversation.assistant_id == Assistant.id)
                .label("conversation_count")
            )
            
            # Base query with ownership filter and conversation count
            stmt = select(
                Assistant,
                conversation_count_subquery
            ).where(Assistant.user_id == user_id)
            
            count_stmt = select(func.count(Assistant.id)).where(Assistant.user_id == user_id)
            
            # Apply status filter
            if request.status_filter:
                if request.status_filter == "active":
                    status_filter = Assistant.is_active == True
                elif request.status_filter == "inactive":
                    status_filter = Assistant.is_active == False
                else:  # draft or other statuses could be added later
                    status_filter = Assistant.is_active == True
                
                stmt = stmt.where(status_filter)
                count_stmt = count_stmt.where(status_filter)
            elif not request.include_inactive:
                # Default to active only unless explicitly including inactive
                stmt = stmt.where(Assistant.is_active == True)
                count_stmt = count_stmt.where(Assistant.is_active == True)
            
            # Apply search filter
            if request.search:
                search_term = f"%{request.search.strip()}%"
                search_filter = or_(
                    Assistant.name.ilike(search_term),
                    Assistant.description.ilike(search_term),
                    Assistant.system_prompt.ilike(search_term)
                )
                stmt = stmt.where(search_filter)
                count_stmt = count_stmt.where(search_filter)
            
            # Apply sorting
            if request.sort_by == "name":
                order_by = Assistant.name.asc() if request.sort_order == "asc" else Assistant.name.desc()
            elif request.sort_by == "created_at":
                order_by = Assistant.created_at.asc() if request.sort_order == "asc" else Assistant.created_at.desc()
            elif request.sort_by == "conversation_count":
                # This requires a subquery to count conversations
                order_by = Assistant.updated_at.desc()  # Fallback for now
            else:  # default to updated_at
                order_by = Assistant.updated_at.asc() if request.sort_order == "asc" else Assistant.updated_at.desc()
            
            stmt = stmt.order_by(order_by)
            
            # Apply pagination
            stmt = stmt.limit(request.limit).offset(request.offset)
            
            # Execute queries
            result = await db.execute(stmt)
            rows = result.all()
            
            # Extract assistants and attach conversation counts
            assistants = []
            for row in rows:
                assistant = row[0]  # Assistant object
                conversation_count = row[1] or 0  # Conversation count
                
                # Attach conversation count as an attribute to avoid lazy loading
                assistant._conversation_count = conversation_count
                assistants.append(assistant)
            
            count_result = await db.execute(count_stmt)
            total_count = count_result.scalar()
            
            logger.debug(
                f"Retrieved {len(assistants)} assistants for user {user_id} "
                f"(total: {total_count}, search: '{request.search}')"
            )
            
            return assistants, total_count
            
        except Exception as e:
            logger.error(f"Failed to get assistants for user {user_id}: {str(e)}")
            raise
    
    async def search_assistants(
        self,
        db: AsyncSession,
        user_id: int,
        search_query: str,
        limit: int = 10
    ) -> List[Assistant]:
        """
        Search assistants with fuzzy matching for autocomplete/quick search.
        
        🎓 LEARNING: Search Optimization with Conversation Counts
        ========================================================
        For user-facing search features, prioritize:
        - Speed (small result sets, efficient queries)
        - Relevance (match names before descriptions)
        - User experience (fast autocomplete responses)
        - Avoid lazy loading for computed fields
        
        Args:
            db: Async database session
            user_id: User performing the search
            search_query: Text to search for
            limit: Maximum results to return
            
        Returns:
            List of matching assistants with pre-computed conversation counts
        """
        try:
            if not search_query or not search_query.strip():
                return []
            
            search_term = f"%{search_query.strip()}%"
            
            # Create subquery for conversation counts
            conversation_count_subquery = (
                select(func.count(ChatConversation.id))
                .where(ChatConversation.assistant_id == Assistant.id)
                .label("conversation_count")
            )
            
            # Prioritize name matches over description matches
            stmt = select(
                Assistant,
                conversation_count_subquery
            ).where(
                and_(
                    Assistant.user_id == user_id,
                    Assistant.is_active == True,
                    or_(
                        Assistant.name.ilike(search_term),
                        Assistant.description.ilike(search_term)
                    )
                )
            ).order_by(
                # Name matches first, then by creation date
                Assistant.name.ilike(search_term).desc(),
                Assistant.created_at.desc()
            ).limit(limit)
            
            result = await db.execute(stmt)
            rows = result.all()
            
            # Extract assistants and attach conversation counts
            assistants = []
            for row in rows:
                assistant = row[0]  # Assistant object
                conversation_count = row[1] or 0  # Conversation count
                
                # Attach conversation count as an attribute to avoid lazy loading
                assistant._conversation_count = conversation_count
                assistants.append(assistant)
            
            logger.debug(f"Search '{search_query}' found {len(assistants)} assistants for user {user_id}")
            return assistants
            
        except Exception as e:
            logger.error(f"Failed to search assistants for user {user_id}: {str(e)}")
            raise
    
    # =============================================================================
    # ASSISTANT WITH CONVERSATIONS
    # =============================================================================
    
    async def get_assistant_with_conversations(
        self,
        db: AsyncSession,
        assistant_id: int,
        user_id: int,
        include_messages: bool = False,
        limit: int = 20
    ) -> Optional[Assistant]:
        """
        Get an assistant with its associated conversations and optionally messages.
        
        🎓 LEARNING: Eager Loading Strategy
        ==================================
        When you need related data, choose the right loading strategy:
        - selectinload: Load related data in separate queries (good for collections)
        - joinedload: Load related data in single query with JOIN (good for single relationships)
        - lazyload: Load on access (default, can cause N+1 problems)
        
        Args:
            db: Async database session
            assistant_id: ID of the assistant
            user_id: ID of the user (for ownership validation)
            include_messages: Whether to load conversation messages
            limit: Maximum conversations to load
            
        Returns:
            Assistant with loaded conversations or None if not found/owned
        """
        try:
            # Build query with appropriate loading strategy
            if include_messages:
                stmt = select(Assistant).options(
                    selectinload(Assistant.conversations).selectinload(Conversation.messages),
                    selectinload(Assistant.chat_conversations),
                    selectinload(Assistant.user)
                )
            else:
                stmt = select(Assistant).options(
                    selectinload(Assistant.conversations),
                    selectinload(Assistant.chat_conversations),
                    selectinload(Assistant.user)
                )
            
            stmt = stmt.where(
                and_(
                    Assistant.id == assistant_id,
                    Assistant.user_id == user_id
                )
            )
            
            result = await db.execute(stmt)
            assistant = result.scalar_one_or_none()
            
            if assistant:
                # Sort conversations by most recent
                if assistant.conversations:
                    assistant.conversations.sort(key=lambda c: c.updated_at or c.created_at, reverse=True)
                    # Limit conversations if needed
                    if len(assistant.conversations) > limit:
                        assistant.conversations = assistant.conversations[:limit]
                
                if assistant.chat_conversations:
                    assistant.chat_conversations.sort(key=lambda c: c.updated_at, reverse=True)
                    if len(assistant.chat_conversations) > limit:
                        assistant.chat_conversations = assistant.chat_conversations[:limit]
                
                logger.debug(
                    f"Retrieved assistant {assistant_id} with "
                    f"{len(assistant.conversations)} conversations and "
                    f"{len(assistant.chat_conversations)} chat conversations"
                )
            
            return assistant
            
        except Exception as e:
            logger.error(f"Failed to get assistant {assistant_id} with conversations: {str(e)}")
            raise
    
    async def create_assistant_conversation(
        self,
        db: AsyncSession,
        assistant_id: int,
        user_id: int,
        conversation_data: AssistantConversationCreate
    ) -> Optional[ChatConversation]:
        """
        Create a new conversation using a specific assistant.
        
        🎓 LEARNING: Cross-Service Operations
        ====================================
        Some operations span multiple domains (assistants + conversations).
        Services can either:
        1. Call other services (loose coupling)
        2. Handle related operations directly (tight coupling but simpler)
        
        This method shows direct handling for simplicity.
        
        Args:
            db: Async database session
            assistant_id: ID of the assistant to use
            user_id: ID of the user creating the conversation
            conversation_data: Conversation creation parameters
            
        Returns:
            Created ChatConversation or None if assistant not found/owned
        """
        try:
            # Validate assistant ownership
            assistant = await self.get_assistant(db, assistant_id, user_id)
            if not assistant:
                logger.warning(f"Assistant {assistant_id} not found or not owned by user {user_id}")
                return None
            
            # Generate title if not provided
            title = conversation_data.title or f"Chat with {assistant.name}"
            
            # Create chat conversation
            chat_conversation = ChatConversation(
                user_id=user_id,
                assistant_id=assistant_id,
                title=title,
                description=f"Conversation using {assistant.name} assistant",
                is_active=True,
                message_count=0
            )
            
            # Create underlying conversation if first message provided
            if conversation_data.first_message:
                # This would typically call the conversation service
                # For now, we'll create a basic conversation
                conversation = Conversation(
                    user_id=user_id,
                    title=title,
                    is_active=True,
                    message_count=1,
                    last_message_at=datetime.utcnow()
                )
                
                db.add(conversation)
                await db.flush()  # Get the conversation ID
                
                chat_conversation.conversation_id = conversation.id
                chat_conversation.message_count = 1
                chat_conversation.last_message_at = datetime.utcnow()
            
            db.add(chat_conversation)
            await db.commit()
            await db.refresh(chat_conversation)
            
            logger.info(
                f"Created conversation '{title}' using assistant {assistant_id} for user {user_id}"
            )
            
            return chat_conversation
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create conversation with assistant {assistant_id}: {str(e)}")
            raise
    
    # =============================================================================
    # ASSISTANT STATISTICS AND ANALYTICS
    # =============================================================================
    
    async def get_assistant_stats(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Get comprehensive statistics about user's assistants.
        
        🎓 LEARNING: Analytics Queries
        =============================
        Analytics often require:
        - Aggregate functions (COUNT, SUM, AVG)
        - Date filtering and grouping
        - Cross-table calculations
        - Performance optimization for large datasets
        
        Args:
            db: Async database session
            user_id: User to get statistics for
            
        Returns:
            Dictionary with various statistics
        """
        try:
            # Total assistants
            total_stmt = select(func.count(Assistant.id)).where(Assistant.user_id == user_id)
            total_result = await db.execute(total_stmt)
            total_assistants = total_result.scalar() or 0
            
            # Active assistants
            active_stmt = select(func.count(Assistant.id)).where(
                and_(Assistant.user_id == user_id, Assistant.is_active == True)
            )
            active_result = await db.execute(active_stmt)
            active_assistants = active_result.scalar() or 0
            
            # Total conversations using assistants
            conversation_stmt = select(func.count(ChatConversation.id)).where(
                and_(
                    ChatConversation.user_id == user_id,
                    ChatConversation.assistant_id.isnot(None)
                )
            )
            conversation_result = await db.execute(conversation_stmt)
            total_conversations = conversation_result.scalar() or 0
            
            # Most used assistant
            most_used_stmt = select(
                Assistant.id,
                Assistant.name,
                func.count(ChatConversation.id).label('conversation_count')
            ).outerjoin(ChatConversation).where(
                Assistant.user_id == user_id
            ).group_by(Assistant.id, Assistant.name).order_by(
                func.count(ChatConversation.id).desc()
            ).limit(1)
            
            most_used_result = await db.execute(most_used_stmt)
            most_used_row = most_used_result.first()
            
            most_used_assistant = None
            if most_used_row and most_used_row.conversation_count > 0:
                most_used_assistant = {
                    "id": most_used_row.id,
                    "name": most_used_row.name,
                    "conversation_count": most_used_row.conversation_count
                }
            
            # Recent activity (last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            recent_stmt = select(Assistant).where(
                and_(
                    Assistant.user_id == user_id,
                    Assistant.created_at >= week_ago
                )
            ).order_by(Assistant.created_at.desc()).limit(5)
            
            recent_result = await db.execute(recent_stmt)
            recent_assistants = recent_result.scalars().all()
            
            recent_activity = [
                {
                    "type": "assistant_created",
                    "assistant_id": assistant.id,
                    "assistant_name": assistant.name,
                    "timestamp": assistant.created_at.isoformat()
                }
                for assistant in recent_assistants
            ]
            
            stats = {
                "total_assistants": total_assistants,
                "active_assistants": active_assistants,
                "inactive_assistants": total_assistants - active_assistants,
                "total_conversations": total_conversations,
                "most_used_assistant": most_used_assistant,
                "recent_activity": recent_activity,
                "assistant_limit": 50,  # Could be dynamic based on user plan
                "usage_percentage": (total_assistants / 50) * 100 if total_assistants > 0 else 0
            }
            
            logger.debug(f"Generated assistant stats for user {user_id}: {total_assistants} assistants")
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get assistant stats for user {user_id}: {str(e)}")
            raise
    
    # =============================================================================
    # ASSISTANT CLONING AND SHARING (FUTURE FEATURES)
    # =============================================================================
    
    async def clone_assistant(
        self,
        db: AsyncSession,
        source_assistant_id: int,
        target_user_id: int,
        new_name: Optional[str] = None
    ) -> Optional[Assistant]:
        """
        Create a copy of an assistant for another user.
        
        🎓 LEARNING: Feature Planning
        ============================
        This method demonstrates planning for future features.
        Even if not fully implemented, having the method signature
        helps with API design and frontend planning.
        
        Args:
            db: Async database session
            source_assistant_id: Assistant to clone
            target_user_id: User who will own the clone
            new_name: Optional new name for the clone
            
        Returns:
            Cloned Assistant or None if source not found
        """
        try:
            # Get source assistant (no ownership check for cloning)
            stmt = select(Assistant).where(Assistant.id == source_assistant_id)
            result = await db.execute(stmt)
            source_assistant = result.scalar_one_or_none()
            
            if not source_assistant:
                return None
            
            # Create clone with new ownership
            clone_name = new_name or f"Copy of {source_assistant.name}"
            clone = source_assistant.clone_for_user(
                target_user=await self._get_user_by_id(db, target_user_id),
                new_name=clone_name
            )
            
            db.add(clone)
            await db.commit()
            await db.refresh(clone)
            
            logger.info(f"Cloned assistant {source_assistant_id} to user {target_user_id}")
            return clone
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to clone assistant {source_assistant_id}: {str(e)}")
            raise
    
    # =============================================================================
    # PRIVATE HELPER METHODS
    # =============================================================================
    
    async def _get_user_assistant_count(self, db: AsyncSession, user_id: int) -> int:
        """Get the count of assistants for a user."""
        stmt = select(func.count(Assistant.id)).where(Assistant.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar() or 0
    
    async def _get_user_assistant_by_name(
        self, 
        db: AsyncSession, 
        user_id: int, 
        name: str
    ) -> Optional[Assistant]:
        """Check if user has an assistant with the given name."""
        stmt = select(Assistant).where(
            and_(
                Assistant.user_id == user_id,
                Assistant.name.ilike(name.strip())
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _get_user_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Get user by ID (helper for cloning operations)."""
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

# =============================================================================
# SERVICE INSTANCE
# =============================================================================

# Create a singleton instance of the service for import by other modules
assistant_service = AssistantService()

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def validate_assistant_ownership(
    db: AsyncSession, 
    assistant_id: int, 
    user_id: int
) -> bool:
    """
    Utility function to validate assistant ownership.
    
    🎓 LEARNING: Utility Functions
    =============================
    Sometimes you need simple validation without full service methods.
    Utility functions provide:
    - Quick ownership checks
    - Simple validations
    - Reusable logic across different services
    
    Args:
        db: Database session
        assistant_id: Assistant to check
        user_id: User to validate ownership for
        
    Returns:
        True if user owns the assistant
    """
    try:
        stmt = select(Assistant.id).where(
            and_(
                Assistant.id == assistant_id,
                Assistant.user_id == user_id
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None
        
    except Exception as e:
        logger.error(f"Failed to validate assistant ownership: {str(e)}")
        return False

async def get_assistant_conversation_count(db: AsyncSession, assistant_id: int) -> int:
    """Get the total number of conversations using an assistant."""
    try:
        stmt = select(func.count(ChatConversation.id)).where(
            ChatConversation.assistant_id == assistant_id
        )
        result = await db.execute(stmt)
        return result.scalar() or 0
        
    except Exception as e:
        logger.error(f"Failed to get conversation count for assistant {assistant_id}: {str(e)}")
        return 0

# =============================================================================
# DEBUGGING AND TESTING HELPERS
# =============================================================================

if __name__ == "__main__":
    print("🤖 Assistant Service Information:")
    print(f"   Service: {AssistantService.__name__}")
    print(f"   Methods: {[method for method in dir(AssistantService) if not method.startswith('_')]}")
    print(f"   Dependencies: Assistant, ChatConversation, Conversation models")
    print(f"   Features: CRUD, search, statistics, ownership validation")
